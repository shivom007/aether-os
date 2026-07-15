/**
 * Web Worker for offloading WebAssembly cryptography and erasure coding.
 * This prevents the main UI thread from freezing during massive file uploads.
 */

import initWasm, { encode_shards, reconstruct_shards, derive_master_key_argon2 } from "wasm-erasure"

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
      const { input, dataShards, parityShards } = payload as { input: ArrayBuffer; dataShards: number; parityShards: number }
      
      const inputBytes = new Uint8Array(input)
      const totalShards = dataShards + parityShards
      const shardSize = Math.ceil(inputBytes.length / dataShards)
      const flatEncodedArray = encode_shards(inputBytes, dataShards, parityShards)
      
      const shards: Uint8Array[] = []
      for (let i = 0; i < totalShards; i++) {
        shards.push(flatEncodedArray.slice(i * shardSize, (i + 1) * shardSize))
      }
      
      const transferables = shards.map(s => s.buffer)
      
      self.postMessage({
        id,
        success: true,
        data: {
          shardSize,
          originalSize: input.byteLength,
          shards
        }
      }, { transfer: transferables })
      
    } else if (type === "RECONSTRUCT_SHARDS") {
      const { availableShards, originalSize, dataShards, parityShards } = payload
      // availableShards is a flattened Uint8Array of the present shards
      // presentIndices is a Uint8Array of the indices
      const { flatPresentShards, indicesArray } = availableShards
      
      const recoveredData = reconstruct_shards(flatPresentShards, indicesArray, originalSize, dataShards, parityShards)
      
      self.postMessage({
        id,
        success: true,
        data: recoveredData
      }, { transfer: [recoveredData.buffer] })

    } else if (type === "DERIVE_MASTER_KEY_ARGON2") {
      const { password, salt } = payload
      
      const rawKey = derive_master_key_argon2(password, salt)
      
      self.postMessage({
        id,
        success: true,
        data: rawKey
      })
    }
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
