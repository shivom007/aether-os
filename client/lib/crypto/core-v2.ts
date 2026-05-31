/**
 * @aether/crypto-core-v2 — hardened browser cryptography for Aether-OS.
 *
 * This v2 engine implements:
 * 1. Deterministic nonces via HKDF
 * 2. AES-GCM AAD binding
 * 3. HKDF salts
 */

// ------- base64 helpers -------
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
export async function derive_master_key_v2(password: string, salt: Uint8Array): Promise<{ masterKey: CryptoKey, fingerprint: string }> {
  let rawKey: Uint8Array;

  if (typeof window === "undefined") {
    throw new Error("Argon2id derivation is only supported in the browser via Web Worker");
  } else {
    const { runInWorker } = await import("../erasure");
    rawKey = await runInWorker<Uint8Array>("DERIVE_MASTER_KEY_ARGON2", {
      password: utf8(password),
      salt
    });
  }
  
  const h = await crypto.subtle.digest("SHA-256", rawKey)
  const fingerprint = toB64(new Uint8Array(h))
  
  const masterKey = await crypto.subtle.importKey(
    "raw", 
    rawKey, 
    "HKDF", 
    false,
    ["deriveBits"]
  )
  
  return { masterKey, fingerprint }
}

// --------------------------------------------------------------------
// V2: Per-chunk key AND deterministic nonce via HKDF-SHA256
// --------------------------------------------------------------------
export async function derive_chunk_key_v2(
  masterKey: CryptoKey,
  kdfSalt: Uint8Array,
  volumeId: string,
  chunkIndex: number,
): Promise<{ chunkKey: Uint8Array, nonce: Uint8Array }> {
  const info = utf8(`aether:v2:${volumeId}:${chunkIndex}:key_and_nonce`)
  
  // Extract 352 bits (44 bytes) to get both a 256-bit key and a 96-bit nonce deterministically
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: kdfSalt, info },
    masterKey,
    352,
  )
  
  const out = new Uint8Array(bits)
  return {
    chunkKey: out.slice(0, 32), // 32 bytes = 256 bits
    nonce: out.slice(32, 44)    // 12 bytes = 96 bits
  }
}

// --------------------------------------------------------------------
// V2: AES-256-GCM encrypt / decrypt (with AAD and Deterministic Nonces)
// --------------------------------------------------------------------

export async function encrypt_chunk_v2(
  plaintext: Uint8Array, 
  keyBytes: Uint8Array, 
  nonce: Uint8Array, 
  aad: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"])
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, key, plaintext)
  return new Uint8Array(ct)
}

export async function decrypt_chunk_v2(
  ciphertext: Uint8Array,
  keyBytes: Uint8Array,
  nonce: Uint8Array,
  aad: Uint8Array
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"])
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, key, ciphertext)
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
