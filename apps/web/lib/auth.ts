import { cookies } from "next/headers"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth-options"
import type { SessionUser } from "./types"

const LEGACY_COOKIE_ACCESS = "aether_access"
const LEGACY_COOKIE_REFRESH = "aether_refresh"
const LEGACY_COOKIE_GO_TOKEN = "aether_go_token"

export async function clearLegacyAuthCookies() {
  const jar = await cookies()
  jar.delete(LEGACY_COOKIE_ACCESS)
  jar.delete(LEGACY_COOKIE_REFRESH)
  jar.delete(LEGACY_COOKIE_GO_TOKEN)
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    const sub = (session as any)?.sub || email
    if (email && sub) return { sub, email }
  } catch (err) {
    console.warn("Failed to get NextAuth session in getSession:", err)
  }

  return null
}

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession()
  if (!s) throw Object.assign(new Error("unauthorized"), { status: 401 })
  return s
}

export const LEGACY_COOKIE_NAMES = {
  access: LEGACY_COOKIE_ACCESS,
  refresh: LEGACY_COOKIE_REFRESH,
  goToken: LEGACY_COOKIE_GO_TOKEN,
} as const
