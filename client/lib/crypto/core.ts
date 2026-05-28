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
