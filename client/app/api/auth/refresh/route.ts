import { ok, fail } from "@/lib/api"
import { setAuthCookies, signAccessToken, newRefreshToken, getRefreshCookie, verifyAccessToken } from "@/lib/auth"
import { cookies } from "next/headers"

const GO_TOKEN_COOKIE = "aether_go_token"

export async function POST() {
  const jar = await cookies()

  // Step 1: Try to get user identity from the access token (even if expired, decode without verify)
  // We use the refresh cookie as the real auth check - access token is just for identity
  const refreshCookie = await getRefreshCookie()
  if (!refreshCookie) return fail("No refresh token", 401)

  // Step 2: Check Go token cookie is still alive (it lasts 24h)
  const goToken = jar.get(GO_TOKEN_COOKIE)?.value
  if (!goToken) return fail("Go session expired. Please log in again.", 401)

  // Step 3: Decode the access token WITHOUT verifying expiry to extract user identity
  // We trust the refresh cookie presence as the auth check
  const accessToken = jar.get("aether_access")?.value
  
  // Try to get identity from access token (may be expired, that's fine)
  let userIdentity: { sub: string; email: string } | null = null
  
  if (accessToken) {
    // verifyAccessToken will return null if expired, so we decode manually
    try {
      const { jwtVerify } = await import("jose")
      const secret = process.env.AUTH_JWT_SECRET
      if (secret) {
        const { payload } = await jwtVerify(
          accessToken,
          new TextEncoder().encode(secret),
          { issuer: "aether", audience: "aether:dashboard", clockTolerance: 86400 * 7 } // allow 7 days of clock tolerance to read expired tokens
        )
        userIdentity = { sub: payload.sub as string, email: payload.email as string }
      }
    } catch {
      // Token is too old to even decode — fall through to null
    }
  }

  if (!userIdentity) return fail("Session unrecoverable. Please log in again.", 401)

  // Step 4: Issue fresh cookies
  const newAccess = await signAccessToken(userIdentity)
  const { token: newRefresh } = await newRefreshToken()
  await setAuthCookies(newAccess, newRefresh)

  // Step 5: Re-stamp the Go token cookie with a fresh maxAge
  jar.set(GO_TOKEN_COOKIE, goToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  })

  return ok({ ok: true })
}
