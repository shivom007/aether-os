import initWasm, { encode_shards, reconstruct_shards } from "../wasm-erasure/pkg/wasm_erasure"

export const DATA_SHARDS = 10
export const PARITY_SHARDS = 4
export const TOTAL_SHARDS = DATA_SHARDS + PARITY_SHARDS

let wasmInitialized = false

/**
 * Initializes the WebAssembly Reed-Solomon Erasure Coding module.
 */
export async function initErasureWasm() {
  if (!wasmInitialized) {
    if (typeof window === "undefined") {
      // Server-side
      const fs = await import("fs")
      const path = await import("path")
      const wasmPath = path.join(process.cwd(), "wasm-erasure", "pkg", "wasm_erasure_bg.wasm")
      const wasmBuffer = fs.readFileSync(wasmPath)
      await initWasm({ module_or_path: wasmBuffer })
    } else {
      // Client-side
      await initWasm({ module_or_path: "/wasm_erasure_bg.wasm" })
    }
    wasmInitialized = true
  }
}

export interface EncodedShards {
  shardSize: number
  originalSize: number
  shards: Uint8Array[] // length 14 (10 data + 4 parity)
}

/**
 * Encodes a buffer into 10 data shards and 4 parity shards using high-performance WebAssembly.
 */
export async function encodeShards(input: Uint8Array): Promise<EncodedShards> {
  await initErasureWasm()
  
  // Calculate padded size
  let shardSize = Math.ceil(input.length / DATA_SHARDS)
  
  // Call Rust WebAssembly
  // The WASM function returns a single flat Uint8Array containing all 14 shards sequentially
  const flatEncodedArray = encode_shards(input)
  
  const shards: Uint8Array[] = []
  for (let i = 0; i < TOTAL_SHARDS; i++) {
    // We slice instead of subarray so it creates a distinct typed array, though it uses same buffer
    shards.push(flatEncodedArray.slice(i * shardSize, (i + 1) * shardSize))
  }

  return { shardSize, originalSize: input.length, shards }
}

/**
 * Reconstructs the original data buffer from any 10 available shards using WebAssembly.
 * Missing shards should be represented as `null` in the array.
 * @param availableShards An array of length 14 containing Uint8Array or null.
 * @param originalSize The original byte length of the file/chunk.
 */
export async function reconstructShards(
  availableShards: (Uint8Array | null)[],
  originalSize: number
): Promise<Uint8Array> {
  await initErasureWasm()

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

  // We only need exactly DATA_SHARDS shards to mathematically rebuild
  const useIndices = presentIndices.slice(0, DATA_SHARDS)

  // Flatten the 10 chosen shards into a single byte array for WASM crossing
  const flatPresentShards = new Uint8Array(DATA_SHARDS * shardSize)
  const indicesArray = new Uint8Array(DATA_SHARDS)
  
  for (let i = 0; i < DATA_SHARDS; i++) {
    const idx = useIndices[i]
    flatPresentShards.set(availableShards[idx]!, i * shardSize)
    indicesArray[i] = idx
  }

  // Call Rust WebAssembly to magically reconstruct the data
  const recoveredData = reconstruct_shards(flatPresentShards, indicesArray, originalSize)

  return recoveredData
}

/**
 * Intelligently fetches exactly DATA_SHARDS (10) shards required for reconstruction.
 * It initiates 10 fetches concurrently. If any fail or timeout, it dynamically requests
 * the next available parity shards to compensate. Aborts remaining fetches once 10 succeed.
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

    const checkCompletion = () => {
      if (successCount >= DATA_SHARDS) {
        abortController.abort() // Cancel any pending/in-flight redundant fetches
        resolve(fetched)
      } else if (failCount > (sortedShards.length - DATA_SHARDS)) {
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
        if (abortController.signal.aborted) return
        fetched[shard.shard_index] = data
        successCount++
        if (onProgress) onProgress()
        checkCompletion()
      } catch (err) {
        if (abortController.signal.aborted) return
        console.warn(`[Shard ${shard.shard_index}] failed:`, err)
        failCount++
        checkCompletion()
        
        // When one fails, immediately try the next available one
        startNextFetch()
      }
    }

    // Kick off the first DATA_SHARDS (10) requests concurrently
    const initialConcurrency = Math.min(DATA_SHARDS, sortedShards.length)
    for (let i = 0; i < initialConcurrency; i++) {
      startNextFetch()
    }
  })
}
