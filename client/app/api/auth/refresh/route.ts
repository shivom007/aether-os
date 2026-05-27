import { ok, fail } from "@/lib/api"
import { getSession, setAuthCookies, signAccessToken, newRefreshToken } from "@/lib/auth"

export async function POST() {
  // For the Go backend integration, we simplify refresh:
  // Just re-issue dashboard cookies if the session is valid.
  const s = await getSession()
  if (!s) return fail("invalid refresh", 401)

  const access = await signAccessToken({ sub: s.sub, email: s.email })
  const { token: refresh } = newRefreshToken()
  await setAuthCookies(access, refresh)
  return ok({ ok: true })
}
