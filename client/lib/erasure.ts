import initWasm, { encode_shards, reconstruct_shards } from "../wasm-erasure/pkg/wasm_erasure"

export const DATA_SHARDS = 10
export const PARITY_SHARDS = 4
export const TOTAL_SHARDS = DATA_SHARDS + PARITY_SHARDS

let erasureWorker: Worker | null = null;
let messageIdCounter = 0;
const pendingResolvers = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

/**
 * Initializes the Web Worker for erasure coding and cryptography.
 */
export async function initErasureWorker() {
  if (!erasureWorker) {
    if (typeof window !== "undefined") {
      // Client-side Web Worker
      erasureWorker = new Worker(new URL('./crypto-worker.ts', import.meta.url), { type: 'module' });
      erasureWorker.onmessage = (e) => {
        const { id, success, data, error } = e.data;
        const resolvers = pendingResolvers.get(id);
        if (resolvers) {
          pendingResolvers.delete(id);
          if (success) resolvers.resolve(data);
          else resolvers.reject(new Error(error));
        }
      };
    } else {
      // Server-side / Node fallback (for tests or server rendering)
      await initWasm();
    }
  }
}

/**
 * Send a message to the Web Worker and wait for the response.
 */
export async function runInWorker<T>(type: string, payload: any, transferables: Transferable[] = []): Promise<T> {
  await initErasureWorker();
  
  if (!erasureWorker) {
    throw new Error("Web Worker not available");
  }

  return new Promise((resolve, reject) => {
    const id = ++messageIdCounter;
    pendingResolvers.set(id, { resolve, reject });
    erasureWorker!.postMessage({ type, payload, id }, { transfer: transferables });
  });
}

export interface EncodedShards {
  shardSize: number
  originalSize: number
  shards: Uint8Array[] // length 14 (10 data + 4 parity)
}

/**
 * Encodes a buffer into 10 data shards and 4 parity shards using high-performance WebAssembly inside a Web Worker.
 */
export async function encodeShards(input: Uint8Array): Promise<EncodedShards> {
  if (typeof window === "undefined") {
    // Server-side fallback (synchronous WASM)
    await initWasm()
    let shardSize = Math.ceil(input.length / DATA_SHARDS)
    const flatEncodedArray = encode_shards(input)
    const shards: Uint8Array[] = []
    for (let i = 0; i < TOTAL_SHARDS; i++) {
      shards.push(flatEncodedArray.slice(i * shardSize, (i + 1) * shardSize))
    }
    return { shardSize, originalSize: input.length, shards }
  }

  // Client-side Web Worker
  // Copy input so we don't accidentally transfer something the UI still needs,
  // or we could transfer it directly if we accept mutating the caller's reference.
  // For safety, we'll copy it before transfer.
  const payloadBuffer = new Uint8Array(input).buffer;
  return await runInWorker<EncodedShards>("ENCODE_SHARDS", payloadBuffer, [payloadBuffer]);
}

/**
 * Reconstructs the original data buffer from any 10 available shards using WebAssembly inside a Web Worker.
 */
export async function reconstructShards(
  availableShards: (Uint8Array | null)[],
  originalSize: number
): Promise<Uint8Array> {
  if (availableShards.length !== TOTAL_SHARDS) {
    throw new Error(`Expected array of length ${TOTAL_SHARDS}`)
  }

  let shardSize = 0
  const presentIndices: number[] = []
  
  for (let i = 0; i < TOTAL_SHARDS; i++) {
    if (availableShards[i]) {
      shardSize = availableShards[i]!.length
      presentIndices.push(i)
    }
  }

  if (presentIndices.length < DATA_SHARDS) {
    throw new Error(`Need at least ${DATA_SHARDS} shards to reconstruct, got ${presentIndices.length}`)
  }

  const useIndices = presentIndices.slice(0, DATA_SHARDS)
  const flatPresentShards = new Uint8Array(DATA_SHARDS * shardSize)
  const indicesArray = new Uint8Array(DATA_SHARDS)
  
  for (let i = 0; i < DATA_SHARDS; i++) {
    const idx = useIndices[i]
    flatPresentShards.set(availableShards[idx]!, i * shardSize)
    indicesArray[i] = idx
  }

  if (typeof window === "undefined") {
    // Server-side fallback
    await initWasm();
    return reconstruct_shards(flatPresentShards, indicesArray, originalSize);
  }

  // Client-side Web Worker
  return await runInWorker<Uint8Array>("RECONSTRUCT_SHARDS", {
    availableShards: { flatPresentShards, indicesArray },
    originalSize
  }, [flatPresentShards.buffer, indicesArray.buffer]);
}

/**
 * Intelligently fetches exactly DATA_SHARDS (10) shards required for reconstruction.
 * Implements Self-Tuning Dynamic Hedging: it tracks the download time of the *fastest* shard,
 * and if the remaining primary shards do not finish within a margin, it races the parity shards.
 */
export async function fetchMinimumShards(
  availableShards: { id: string; shard_index: number }[],
  fetcher: (id: string, signal: AbortSignal) => Promise<Uint8Array>,
  onProgress?: () => void
): Promise<(Uint8Array | null)[]> {
  const fetched: (Uint8Array | null)[] = new Array(TOTAL_SHARDS).fill(null)
  
  if (availableShards.length < DATA_SHARDS) {
    throw new Error(`Only ${availableShards.length} shards available. Need at least ${DATA_SHARDS}`)
  }

  // Ensure shards are ordered by shard_index so we prioritize primary data shards (0-9) over parity (10-13)
  const sortedShards = [...availableShards].sort((a, b) => a.shard_index - b.shard_index)
  
  return new Promise((resolve, reject) => {
    let successCount = 0
    let failCount = 0
    let nextToFetch = 0
    const abortController = new AbortController()
    
    let fastestShardTimeMs: number | null = null
    const startTime = Date.now()
    let hedgeTimerId: ReturnType<typeof setTimeout> | null = null

    const checkCompletion = () => {
      if (successCount >= DATA_SHARDS) {
        if (hedgeTimerId) clearTimeout(hedgeTimerId)
        abortController.abort() // Cancel any pending/in-flight redundant fetches
        resolve(fetched)
      } else if (failCount > (sortedShards.length - DATA_SHARDS)) {
        if (hedgeTimerId) clearTimeout(hedgeTimerId)
        abortController.abort()
        reject(new Error(`Failed to fetch enough shards. ${failCount} failed.`))
      }
    }

    const startNextFetch = async () => {
      if (successCount >= DATA_SHARDS || nextToFetch >= sortedShards.length) return
      if (abortController.signal.aborted) return
      
      const shard = sortedShards[nextToFetch++]
      try {
        const data = await fetcher(shard.id, abortController.signal)
        if (abortController.signal.aborted) return // silently discard — we already have enough
        
        fetched[shard.shard_index] = data
        successCount++
        
        // DYNAMIC HEDGING LOGIC
        if (fastestShardTimeMs === null) {
          fastestShardTimeMs = Date.now() - startTime
          // We set a dynamic margin (e.g., 50% extra time, with a minimum of 200ms)
          const margin = Math.max(fastestShardTimeMs * 0.5, 200)
          
          hedgeTimerId = setTimeout(() => {
            // Hedge window expired! Fire all remaining parity shards to race the stragglers
            if (successCount < DATA_SHARDS && !abortController.signal.aborted) {
              console.log(`[Hedging] Fastest shard took ${fastestShardTimeMs!}ms. Hedging at ${fastestShardTimeMs! + margin}ms by firing parity shards.`)
              while (nextToFetch < sortedShards.length) {
                startNextFetch().catch(() => {})
              }
            }
          }, margin)
        }

        if (onProgress) onProgress()
        checkCompletion()
      } catch (err) {
        // Silently ignore AbortErrors — these are expected when we have enough shards
        if ((err as Error)?.name === "AbortError" || abortController.signal.aborted) return
        console.warn(`[Shard ${shard.shard_index}] failed:`, err)
        failCount++
        checkCompletion()
        
        // When one fails, immediately try the next available one
        startNextFetch().catch(() => {})
      }
    }

    // Kick off the first DATA_SHARDS (10) requests concurrently
    const initialConcurrency = Math.min(DATA_SHARDS, sortedShards.length)
    for (let i = 0; i < initialConcurrency; i++) {
      startNextFetch().catch(() => {})
    }
  })
}
