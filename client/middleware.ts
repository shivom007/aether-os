import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify, SignJWT } from "jose"

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/refresh",
  "/metrics",
  "/_next",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/privacy",
  "/terms",
  "/_vercel"
]

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)))
}

const ACCESS_TTL_SEC = 15 * 60

async function makeSecret() {
  const s = process.env.AUTH_JWT_SECRET
  if (!s) throw new Error("AUTH_JWT_SECRET missing")
  return new TextEncoder().encode(s)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const accessToken = req.cookies.get("aether_access")?.value
  const refreshToken = req.cookies.get("aether_refresh")?.value
  const goToken = req.cookies.get("aether_go_token")?.value

  const secret = await makeSecret().catch(() => null)
  if (!secret) return NextResponse.next() // misconfigured — let through

  // ✅ 1. Access token is valid — let through immediately
  if (accessToken) {
    try {
      await jwtVerify(accessToken, secret, { issuer: "aether", audience: "aether:dashboard" })
      return NextResponse.next()
    } catch {
      // Expired or invalid — fall through to refresh
    }
  }

  // 🔄 2. Access token expired — try to silently re-issue using expired token's identity
  // We trust the presence of the refresh cookie as the "session is still alive" signal
  if (refreshToken && goToken && accessToken) {
    try {
      // Decode the expired access token with relaxed clock to extract user identity
      const { payload } = await jwtVerify(accessToken, secret, {
        issuer: "aether",
        audience: "aether:dashboard",
        clockTolerance: 60 * 60 * 24 * 7, // allow up to 7 days expired
      })

      const sub = payload.sub as string
      const email = payload.email as string

      if (sub && email) {
        // Issue a brand new access token directly in the middleware
        const newAccessToken = await new SignJWT({ email })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(sub)
          .setIssuedAt()
          .setIssuer("aether")
          .setAudience("aether:dashboard")
          .setExpirationTime(`${ACCESS_TTL_SEC}s`)
          .sign(secret)

        const isProd = process.env.NODE_ENV === "production"
        const response = NextResponse.next()

        // Stamp the fresh access token cookie onto the response
        response.cookies.set("aether_access", newAccessToken, {
          httpOnly: true,
          secure: isProd,
          sameSite: "lax",
          path: "/",
          maxAge: ACCESS_TTL_SEC,
        })

        return response
      }
    } catch (err) {
      console.error("Silent token refresh failed:", err)
    }
  }

  // ❌ 3. Cannot refresh — redirect to login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)" ],
}
