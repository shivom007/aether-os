import initWasm, { encode_shards, reconstruct_shards } from "wasm-erasure"

export const DEFAULT_DATA_SHARDS = 10
export const DEFAULT_PARITY_SHARDS = 4

let erasureWorker: Worker | null = null;
if (typeof window !== "undefined") {
  try {
    erasureWorker = new Worker(new URL('./crypto-worker.ts', import.meta.url));
  } catch (err) {
    console.error("Failed to initialize Web Worker statically:", err);
  }
}

let messageIdCounter = 0;
const pendingResolvers = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

/**
 * Initializes the Web Worker for erasure coding and cryptography.
 */
export async function initErasureWorker() {
  if (typeof window !== "undefined") {
    if (erasureWorker && !erasureWorker.onmessage) {
      erasureWorker.onmessage = (e) => {
        const { id, success, data, error } = e.data;
        const resolvers = pendingResolvers.get(id);
        if (resolvers) {
          pendingResolvers.delete(id);
          if (success) resolvers.resolve(data);
          else resolvers.reject(new Error(error));
        }
      };
    }
  } else {
    // Server-side / Node fallback
    await initWasm();
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
 * Encodes a buffer into data shards and parity shards using high-performance WebAssembly inside a Web Worker.
 */
export async function encodeShards(
  input: Uint8Array, 
  dataShards = DEFAULT_DATA_SHARDS, 
  parityShards = DEFAULT_PARITY_SHARDS
): Promise<EncodedShards> {
  const totalShards = dataShards + parityShards;

  if (typeof window === "undefined") {
    // Server-side fallback (synchronous WASM)
    await initWasm()
    let shardSize = Math.ceil(input.length / dataShards)
    const flatEncodedArray = encode_shards(input, dataShards, parityShards)
    const shards: Uint8Array[] = []
    for (let i = 0; i < totalShards; i++) {
      shards.push(flatEncodedArray.slice(i * shardSize, (i + 1) * shardSize))
    }
    return { shardSize, originalSize: input.length, shards }
  }

  // Client-side Web Worker
  const payloadBuffer = new Uint8Array(input).buffer;
  return await runInWorker<EncodedShards>("ENCODE_SHARDS", {
    input: payloadBuffer,
    dataShards,
    parityShards
  }, [payloadBuffer]);
}

/**
 * Reconstructs the original data buffer from any K available shards using WebAssembly inside a Web Worker.
 */
export async function reconstructShards(
  availableShards: (Uint8Array | null)[],
  originalSize: number,
  dataShards = DEFAULT_DATA_SHARDS,
  parityShards = DEFAULT_PARITY_SHARDS
): Promise<Uint8Array> {
  const totalShards = dataShards + parityShards;

  if (availableShards.length !== totalShards) {
    throw new Error(`Expected array of length ${totalShards}`)
  }

  let shardSize = 0
  const presentIndices: number[] = []
  
  for (let i = 0; i < totalShards; i++) {
    if (availableShards[i]) {
      shardSize = availableShards[i]!.length
      presentIndices.push(i)
    }
  }

  if (presentIndices.length < dataShards) {
    throw new Error(`Need at least ${dataShards} shards to reconstruct, got ${presentIndices.length}`)
  }

  const useIndices = presentIndices.slice(0, dataShards)
  const flatPresentShards = new Uint8Array(dataShards * shardSize)
  const indicesArray = new Uint8Array(dataShards)
  
  for (let i = 0; i < dataShards; i++) {
    const idx = useIndices[i]
    flatPresentShards.set(availableShards[idx]!, i * shardSize)
    indicesArray[i] = idx
  }

  if (typeof window === "undefined") {
    // Server-side fallback
    await initWasm();
    return reconstruct_shards(flatPresentShards, indicesArray, originalSize, dataShards, parityShards);
  }

  // Client-side Web Worker
  return await runInWorker<Uint8Array>("RECONSTRUCT_SHARDS", {
    availableShards: { flatPresentShards, indicesArray },
    originalSize,
    dataShards,
    parityShards
  }, [flatPresentShards.buffer, indicesArray.buffer]);
}

/**
 * Intelligently fetches exactly DATA_SHARDS required for reconstruction.
 * Implements Self-Tuning Dynamic Hedging: it tracks the download time of the *fastest* shard,
 * and if the remaining primary shards do not finish within a margin, it races the parity shards.
 */
export async function fetchMinimumShards(
  availableShards: { id: string; shard_index: number }[],
  fetcher: (id: string, signal: AbortSignal) => Promise<Uint8Array>,
  onProgress?: () => void,
  dataShards = DEFAULT_DATA_SHARDS,
  parityShards = DEFAULT_PARITY_SHARDS
): Promise<(Uint8Array | null)[]> {
  const totalShards = dataShards + parityShards;
  const fetched: (Uint8Array | null)[] = new Array(totalShards).fill(null)
  
  if (availableShards.length < dataShards) {
    throw new Error(`Only ${availableShards.length} shards available. Need at least ${dataShards}`)
  }

  // Ensure shards are ordered by shard_index so we prioritize primary data shards over parity
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
      if (successCount >= dataShards) {
        if (hedgeTimerId) clearTimeout(hedgeTimerId)
        try { abortController.abort() } catch (e) {} // Cancel any pending/in-flight redundant fetches
        resolve(fetched)
      } else if (failCount > (sortedShards.length - dataShards)) {
        if (hedgeTimerId) clearTimeout(hedgeTimerId)
        try { abortController.abort() } catch (e) {}
        reject(new Error(`Failed to fetch enough shards. ${failCount} failed.`))
      }
    }

    const startNextFetch = async () => {
      if (successCount >= dataShards || nextToFetch >= sortedShards.length) return
      if (abortController.signal.aborted) return
      
      const shard = sortedShards[nextToFetch++]
      try {
        const data = await fetcher(shard.id, abortController.signal)
        if (abortController.signal.aborted) return
        
        fetched[shard.shard_index] = data
        successCount++
        
        // DYNAMIC HEDGING LOGIC
        if (fastestShardTimeMs === null) {
          fastestShardTimeMs = Date.now() - startTime
          // We set a dynamic margin (e.g., 50% extra time, with a minimum of 200ms)
          const margin = Math.max(fastestShardTimeMs * 0.5, 200)
          
          hedgeTimerId = setTimeout(() => {
            // Hedge window expired! Fire all remaining parity shards to race the stragglers
            if (successCount < dataShards && !abortController.signal.aborted) {
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
        if (abortController.signal.aborted) return
        console.warn(`[Shard ${shard.shard_index}] failed:`, err)
        failCount++
        checkCompletion()
        
        // When one fails, immediately try the next available one
        startNextFetch().catch(() => {})
      }
    }

    // Kick off the first requests concurrently
    const initialConcurrency = Math.min(dataShards, sortedShards.length)
    for (let i = 0; i < initialConcurrency; i++) {
      startNextFetch().catch(() => {})
    }
  })
}
