import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { createHash, randomBytes } from "node:crypto"
import type { SessionUser } from "./types"

const ACCESS_TTL_SEC = 15 * 60
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60

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

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "aether", audience: "aether:dashboard" })
    return { sub: payload.sub as string, email: payload.email as string }
  } catch {
    return null
  }
}

// Refresh tokens are random opaque strings. We store a SHA-256 hash in DB.
export function newRefreshToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url")
  const hash = createHash("sha256").update(token).digest("hex")
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000)
  return { token, hash, expiresAt }
}
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
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
