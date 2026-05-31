/**
 * @aether/crypto-core — browser cryptography for Aether-OS.
 *
 * Zero-knowledge: the master key NEVER leaves the client. Every routine here
 * mirrors the signature of the forthcoming WASM crate so the import can be
 * swapped 1:1 without changing callers.
 *
 *   derive_master_key(password, salt)          -> master key  (never uploaded)
 *   derive_chunk_key (masterKey, volumeId, i)  -> per-chunk key
 *   encrypt_chunk    (plaintext, key)          -> { iv, ciphertext }
 *   decrypt_chunk    (ciphertext, iv, key)     -> plaintext
 */

// ------- base64 helpers (available in both DOM + edge runtimes) -------
export function toB64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let bin = ""
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin)
  }
  return Buffer.from(bytes).toString("base64")
}
export function fromB64(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  return new Uint8Array(Buffer.from(b64, "base64"))
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

export function randomBytes(n: number): Uint8Array {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

// --------------------------------------------------------------------
// Master key derivation: Argon2id (via Web Worker), 32-byte output
// --------------------------------------------------------------------
export async function derive_master_key(password: string, salt: Uint8Array): Promise<{ masterKey: CryptoKey, fingerprint: string }> {
  let rawKey: Uint8Array;

  if (typeof window === "undefined") {
    // Server-side fallback (if ever needed in node)
    throw new Error("Argon2id derivation is only supported in the browser via Web Worker");
  } else {
    // Client-side Web Worker using Argon2id WebAssembly
    const { runInWorker } = await import("../erasure");
    rawKey = await runInWorker<Uint8Array>("DERIVE_MASTER_KEY_ARGON2", {
      password: utf8(password),
      salt
    });
  }

  // Calculate fingerprint before locking the key
  const h = await crypto.subtle.digest("SHA-256", rawKey)
  const fingerprint = toB64(new Uint8Array(h))

  // Import the raw key as an unextractable CryptoKey
  const masterKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    "HKDF",
    false, // extractable: false! Physical protection against memory scraping / XSS
    ["deriveBits"]
  )

  return { masterKey, fingerprint }
}

// --------------------------------------------------------------------
// Per-chunk key via HKDF-SHA256
// --------------------------------------------------------------------
export async function derive_chunk_key(
  masterKey: CryptoKey,
  volumeId: string,
  chunkIndex: number,
): Promise<Uint8Array> {
  const info = utf8(`aether:v1:${volumeId}:${chunkIndex}`)
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info },
    masterKey,
    256,
  )
  return new Uint8Array(bits)
}

// --------------------------------------------------------------------
// AES-256-GCM encrypt / decrypt
// --------------------------------------------------------------------
export interface EncryptedChunk {
  iv: Uint8Array // 12 bytes
  ciphertext: Uint8Array // plaintext.length + 16 (GCM tag)
}

export async function encrypt_chunk(plaintext: Uint8Array, keyBytes: Uint8Array): Promise<EncryptedChunk> {
  const iv = randomBytes(12)
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"])
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
  return { iv, ciphertext: new Uint8Array(ct) }
}

export async function decrypt_chunk(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  keyBytes: Uint8Array,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"])
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
  return new Uint8Array(pt)
}

// SHA-256 helper
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data))
}

// --------- convenience aliases for callers / WASM parity ---------
export const bytesToBase64 = toB64
export const base64ToBytes = fromB64

export function random_salt(): Uint8Array {
  return randomBytes(16)
}

/**
 * @aether/crypto-core — browser cryptography for Aether-OS.
 *
 * Zero-knowledge: the master key NEVER leaves the client. Every routine here
 * mirrors the signature of the forthcoming WASM crate so the import can be
 * swapped 1:1 without changing callers.
 *
 *   derive_master_key(password, salt)          -> master key  (never uploaded)
 *   derive_chunk_key (masterKey, volumeId, i)  -> per-chunk key
 *   encrypt_chunk    (plaintext, key)          -> { iv, ciphertext }
 *   decrypt_chunk    (ciphertext, iv, key)     -> plaintext
 *
 * tsconfig requirement: lib must include "DOM" and "DOM.Iterable" (ES2020+)
 * so that Uint8Array is assignable to BufferSource via ArrayBufferView.
 */
/**
 * @aether/crypto-core — browser cryptography for Aether-OS.
 *
 * Zero-knowledge: the master key NEVER leaves the client. Every routine here
 * mirrors the signature of the forthcoming WASM crate so the import can be
 * swapped 1:1 without changing callers.
 *
 *   derive_master_key(password, salt)          -> master key  (never uploaded)
 *   derive_chunk_key (masterKey, volumeId, i)  -> per-chunk key
 *   encrypt_chunk    (plaintext, key)          -> { iv, ciphertext }
 *   decrypt_chunk    (ciphertext, iv, key)     -> plaintext
 */

// ------- base64 helpers -------
// export function toB64(bytes: Uint8Array): string {
//   if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
//   if (typeof btoa === "function") {
//     let bin = ""
//     for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
//     return btoa(bin)
//   }
//   throw new Error("No base64 encoder available in this runtime")
// }

// export function fromB64(b64: string): Uint8Array {
//   if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"))
//   if (typeof atob === "function") {
//     const bin = atob(b64)
//     const out = new Uint8Array(bin.length)
//     for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
//     return out
//   }
//   throw new Error("No base64 decoder available in this runtime")
// }

// function utf8(s: string): Uint8Array {
//   return new TextEncoder().encode(s)
// }

// function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
//   const out = new Uint8Array(a.length + b.length)
//   out.set(a, 0)
//   out.set(b, a.length)
//   return out
// }

// /**
//  * Extracts a guaranteed plain ArrayBuffer from a Uint8Array.
//  *
//  * Why not `.buffer as ArrayBuffer`:
//  *   - `.buffer` is typed `ArrayBufferLike` = `ArrayBuffer | SharedArrayBuffer`.
//  *     Web Crypto rejects SharedArrayBuffer; TS correctly flags the cast as unsafe.
//  *   - `.slice()` always returns a real ArrayBuffer — the cast below is sound.
//  *
//  * Why not just `.buffer.slice(0)`:
//  *   - A Uint8Array can be a sub-view of a larger buffer (byteOffset > 0).
//  *     Slicing from 0 would include bytes outside the view. We slice exactly
//  *     the view's own byte range so crypto ops see only the intended bytes.
//  */
// function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
//   return bytes.buffer.slice(
//     bytes.byteOffset,
//     bytes.byteOffset + bytes.byteLength,
//   ) as ArrayBuffer
// }

// export function randomBytes(n: number): Uint8Array {
//   const a = new Uint8Array(n)
//   crypto.getRandomValues(a)
//   return a
// }

// // --------------------------------------------------------------------
// // Master key derivation: Argon2id (via Web Worker), 32-byte output
// // --------------------------------------------------------------------
// export async function derive_master_key(
//   password: string,
//   salt: Uint8Array,
// ): Promise<{ masterKey: CryptoKey; fingerprint: string }> {
//   let rawKey: Uint8Array

//   if (typeof window === "undefined") {
//     throw new Error("Argon2id derivation is only supported in the browser via Web Worker")
//   } else {
//     const { runInWorker } = await import("../erasure")
//     rawKey = await runInWorker<Uint8Array>("DERIVE_MASTER_KEY_ARGON2", {
//       password: utf8(password),
//       salt,
//     })
//   }

//   const h = await crypto.subtle.digest("SHA-256", toArrayBuffer(rawKey))
//   const fingerprint = toB64(new Uint8Array(h))

//   const masterKey = await crypto.subtle.importKey(
//     "raw",
//     toArrayBuffer(rawKey),
//     "HKDF",
//     false, // extractable: false — physical protection against memory scraping / XSS
//     ["deriveBits"],
//   )

//   // Zero raw key bytes now that the unextractable CryptoKey is created
//   rawKey.fill(0)

//   return { masterKey, fingerprint }
// }

// // --------------------------------------------------------------------
// // Per-chunk key via HKDF-SHA256
// // --------------------------------------------------------------------
// export async function derive_chunk_key(
//   masterKey: CryptoKey,
//   volumeId: string,
//   chunkIndex: number,
// ): Promise<Uint8Array> {
//   // Encode chunkIndex as fixed-width big-endian u32 — byte-identical to the
//   // Rust/WASM implementation. String templates produce variable-length bytes
//   // (`${1}` vs `${10}`), which would silently derive different keys across
//   // the JS/WASM boundary for the same chunk.
//   const indexBytes = new Uint8Array(4)
//   new DataView(indexBytes.buffer).setUint32(0, chunkIndex, false /* big-endian */)
//   const info = concatBytes(utf8(`aether:v1:${volumeId}:`), indexBytes)

//   const bits = await crypto.subtle.deriveBits(
//     { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info } as HkdfParams,
//     masterKey,
//     256,
//   )
//   return new Uint8Array(bits)
// }

// // --------------------------------------------------------------------
// // AES-256-GCM encrypt / decrypt
// // --------------------------------------------------------------------
// export interface EncryptedChunk {
//   iv: Uint8Array         // 12 bytes
//   ciphertext: Uint8Array // plaintext.length + 16 (GCM tag)
// }

// export async function encrypt_chunk(
//   plaintext: Uint8Array,
//   keyBytes: Uint8Array,
// ): Promise<EncryptedChunk> {
//   const iv = randomBytes(12)
//   const key = await crypto.subtle.importKey(
//     "raw",
//     toArrayBuffer(keyBytes),
//     { name: "AES-GCM" },
//     false,
//     ["encrypt"],
//   )
//   const ct = await crypto.subtle.encrypt(
//     { name: "AES-GCM", iv: toArrayBuffer(iv) },
//     key,
//     toArrayBuffer(plaintext),
//   )
//   return { iv, ciphertext: new Uint8Array(ct) }
// }

// export async function decrypt_chunk(
//   ciphertext: Uint8Array,
//   iv: Uint8Array,
//   keyBytes: Uint8Array,
// ): Promise<Uint8Array> {
//   const key = await crypto.subtle.importKey(
//     "raw",
//     toArrayBuffer(keyBytes),
//     { name: "AES-GCM" },
//     false,
//     ["decrypt"],
//   )
//   const pt = await crypto.subtle.decrypt(
//     { name: "AES-GCM", iv: toArrayBuffer(iv) },
//     key,
//     toArrayBuffer(ciphertext),
//   )
//   return new Uint8Array(pt)
// }

// // SHA-256 helper
// export async function sha256(data: Uint8Array): Promise<Uint8Array> {
//   return new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(data)))
// }

// // --------- convenience aliases for callers / WASM parity ---------
// export const bytesToBase64 = toB64
// export const base64ToBytes = fromB64

// // 32-byte salt — Argon2id OWASP recommendation for master key derivation
// // (16 bytes is the spec minimum; 32 is preferred for high-security contexts)
// export function random_salt(): Uint8Array {
//   return randomBytes(32)
// }