import { ok, fail } from "@/lib/api"
import { setAuthCookies, signAccessToken, signRefreshToken, getRefreshCookie, verifyRefreshToken } from "@/lib/auth"
import { cookies } from "next/headers"

const GO_TOKEN_COOKIE = "aether_go_token"

export async function POST() {
  const jar = await cookies()

  const refreshCookie = await getRefreshCookie()
  if (!refreshCookie) return fail("No refresh token", 401)

  const userIdentity = await verifyRefreshToken(refreshCookie)
  if (!userIdentity) return fail("Invalid refresh token", 401)

  const goToken = jar.get(GO_TOKEN_COOKIE)?.value
  if (!goToken) return fail("Go session expired. Please log in again.", 401)

  const newAccess = await signAccessToken(userIdentity)
  const newRefresh = await signRefreshToken(userIdentity)
  await setAuthCookies(newAccess, newRefresh)

  jar.set(GO_TOKEN_COOKIE, goToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  })

  return ok({ ok: true })
}
