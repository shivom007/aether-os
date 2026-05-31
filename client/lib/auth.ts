import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { SessionUser } from "./types"

const ACCESS_TTL_SEC = 24 * 60 * 60   // 24 hours
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60 // 7 days

function secret(): Uint8Array {
  const s = process.env.AUTH_JWT_SECRET
  if (!s) throw new Error("AUTH_JWT_SECRET is not set")
  return new TextEncoder().encode(s)
}

export async function signAccessToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setIssuer("aether")
    .setAudience("aether:dashboard")
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret())
}

export async function signRefreshToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setIssuer("aether")
    .setAudience("aether:refresh")
    .setExpirationTime(`${REFRESH_TTL_SEC}s`)
    .sign(secret())
}

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "aether", audience: "aether:dashboard" })
    return { sub: payload.sub as string, email: payload.email as string }
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "aether", audience: "aether:refresh" })
    if (payload.typ !== "refresh") return null
    return { sub: payload.sub as string, email: payload.email as string }
  } catch {
    return null
  }
}

// Convert a buffer to hex
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// Base64URL string
function toBase64Url(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

// Refresh tokens are random opaque strings. We store a SHA-256 hash in DB.
export async function newRefreshToken(): Promise<{ token: string; hash: string; expiresAt: Date }> {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const token = toBase64Url(randomBytes)
  const hash = await hashRefreshToken(token)
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000)
  return { token, hash, expiresAt }
}

export async function hashRefreshToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return toHex(hashBuffer)
}

// --- cookie helpers (Next.js 16 — cookies() is async) ---
const COOKIE_ACCESS = "aether_access"
const COOKIE_REFRESH = "aether_refresh"

export async function setAuthCookies(access: string, refresh: string) {
  const jar = await cookies()
  const isProd = process.env.NODE_ENV === "production"
  jar.set(COOKIE_ACCESS, access, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  })
  jar.set(COOKIE_REFRESH, refresh, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_SEC,
  })
}

export async function clearAuthCookies() {
  const jar = await cookies()
  jar.delete(COOKIE_ACCESS)
  jar.delete(COOKIE_REFRESH)
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_ACCESS)?.value
  if (!token) return null
  return verifyAccessToken(token)
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) throw Object.assign(new Error("unauthorized"), { status: 401 })
  return s
}

export async function getRefreshCookie(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE_REFRESH)?.value ?? null
}

export const COOKIE_NAMES = { access: COOKIE_ACCESS, refresh: COOKIE_REFRESH } as const
