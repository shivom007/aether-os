/**
 * Server-side helpers. These touch only secrets the SERVER owns
 * (SERVER_WRAPPING_KEY_B64) — never the user's zero-knowledge master key.
 */
import { scryptSync, randomBytes as nodeRandomBytes, createCipheriv, createDecipheriv } from "node:crypto"

function getWrappingKey(): Buffer {
  const b64 = process.env.SERVER_WRAPPING_KEY_B64
  if (!b64) {
    // Return a dummy key — server-side wrapping is handled by Go backend
    return Buffer.alloc(32)
  }
  const key = Buffer.from(b64, "base64")
  if (key.length !== 32) throw new Error("SERVER_WRAPPING_KEY_B64 must be 32 bytes (base64)")
  return key
}

// ----- password hashing (scrypt) -----
export function hashPassword(password: string): string {
  const salt = nodeRandomBytes(16)
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltB64, hashB64] = stored.split("$")
  if (algo !== "scrypt") return false
  const salt = Buffer.from(saltB64, "base64")
  const expected = Buffer.from(hashB64, "base64")
  const derived = scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 })
  // constant-time compare
  if (derived.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i]
  return diff === 0
}

// ----- wrap / unwrap provider tokens (AES-256-GCM) -----
export function wrapSecret(plaintext: Uint8Array): Buffer {
  const key = getWrappingKey()
  const iv = nodeRandomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]) // [iv(12) | tag(16) | ct]
}

export function unwrapSecret(wrapped: Buffer): Buffer {
  const key = getWrappingKey()
  const iv = wrapped.subarray(0, 12)
  const tag = wrapped.subarray(12, 28)
  const ct = wrapped.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}
