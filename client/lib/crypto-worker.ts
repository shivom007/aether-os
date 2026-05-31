/**
 * Web Worker for offloading WebAssembly cryptography and erasure coding.
 * This prevents the main UI thread from freezing during massive file uploads.
 */

import initWasm, { encode_shards, reconstruct_shards, derive_master_key_argon2 } from "../wasm-erasure/pkg/wasm_erasure"

let wasmInitialized = false

async function ensureWasm() {
  if (!wasmInitialized) {
    // In a Web Worker, we can fetch the WASM file
    await initWasm({ module_or_path: "/wasm_erasure_bg.wasm" })
    wasmInitialized = true
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data

  try {
    await ensureWasm()

    if (type === "ENCODE_SHARDS") {
      const input = new Uint8Array(payload)
      const DATA_SHARDS = 10
      const PARITY_SHARDS = 4
      const TOTAL_SHARDS = DATA_SHARDS + PARITY_SHARDS
      
      const shardSize = Math.ceil(input.length / DATA_SHARDS)
      const flatEncodedArray = encode_shards(input)
      
      const shards: Uint8Array[] = []
      for (let i = 0; i < TOTAL_SHARDS; i++) {
        shards.push(flatEncodedArray.slice(i * shardSize, (i + 1) * shardSize))
      }
      
      // Transfer the shard buffers back to main thread without copying
      const transferables = shards.map(s => s.buffer)
      
      self.postMessage({
        id,
        success: true,
        data: {
          shardSize,
          originalSize: input.length,
          shards
        }
      }, { transfer: transferables })
      
    } else if (type === "RECONSTRUCT_SHARDS") {
      const { availableShards, originalSize } = payload
      // availableShards is a flattened Uint8Array of the present shards
      // presentIndices is a Uint8Array of the indices
      const { flatPresentShards, indicesArray } = availableShards
      
      const recoveredData = reconstruct_shards(flatPresentShards, indicesArray, originalSize)
      
      self.postMessage({
        id,
        success: true,
        data: recoveredData
      }, { transfer: [recoveredData.buffer] })

    } else if (type === "DERIVE_MASTER_KEY_ARGON2") {
      const { password, salt } = payload
      
      const rawKey = derive_master_key_argon2(password, salt)
      // Copy into a fresh Uint8Array to ensure it's a proper transferable buffer
      // (WASM memory can sometimes return views that aren't directly transferable)
      const keyCopy = new Uint8Array(rawKey)
      
      self.postMessage({
        id,
        success: true,
        data: keyCopy
      }, { transfer: [keyCopy.buffer] })
    }
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
