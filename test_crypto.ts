import { derive_master_key, derive_chunk_key, encrypt_chunk, decrypt_chunk, toB64, fromB64, CHUNK_SIZE } from "./client/lib/crypto/core.ts"
import { encodeShards, reconstructShards, DATA_SHARDS } from "./client/lib/erasure.ts"
import crypto from "crypto"

// Polyfill WebCrypto for Node
if (!globalThis.crypto) {
  (globalThis as any).crypto = crypto.webcrypto as any
}

async function run() {
  const fileBytes = new Uint8Array(440264)
  for (let i = 0; i < fileBytes.length; i++) fileBytes[i] = i % 256

  const passphrase = "password123"
  const kdfSalt = crypto.randomBytes(16)
  const volumeId = "test-vol"

  const masterKey = await derive_master_key(passphrase, kdfSalt)
  const chunkKey = await derive_chunk_key(masterKey, volumeId, 0)
  
  const { iv, ciphertext } = await encrypt_chunk(fileBytes, chunkKey)
  
  const body = new Uint8Array(iv.length + ciphertext.length)
  body.set(iv, 0)
  body.set(ciphertext, iv.length)

  const encoded = encodeShards(body)
  
  // Simulate download
  const fetchedShards = encoded.shards.slice(0, DATA_SHARDS).map(s => new Uint8Array(s))

  const originalSize = fileBytes.length + 16 + 12
  const reconstructed = reconstructShards(fetchedShards, originalSize)
  
  const rIv = reconstructed.slice(0, 12)
  const rCiphertext = reconstructed.slice(12)

  // Simulate wrong password during decryption
  const wrongMasterKey = await derive_master_key("wrong_password123", kdfSalt)
  const wrongChunkKey = await derive_chunk_key(wrongMasterKey, volumeId, 0)
  
  try {
    const pt = await decrypt_chunk(rCiphertext, rIv, wrongChunkKey)
    console.log("Success! Match?", pt.length === fileBytes.length)
  } catch (e) {
    console.error("Failed!", e)
  }
}
run()
