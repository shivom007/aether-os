import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify, SignJWT } from "jose"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth",
  "/metrics",
  "/_next",
  "/favicon",
  "/icon",
  "/apple-icon",
  "/privacy",
  "/terms",
  "/about",
  "/careers",
  "/early-access",
  "/features",
  "/pipeline",
  "/security",
  "/teams",
  "/_vercel"
]

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)))
}

const ACCESS_TTL_SEC = 24 * 60 * 60 // 24 hours — must match lib/auth.ts

async function makeSecret() {
  const s = process.env.AUTH_JWT_SECRET
  if (!s) throw new Error("AUTH_JWT_SECRET missing")
  return new TextEncoder().encode(s)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const accessToken = req.cookies.get("aether_access")?.value
  const refreshToken = req.cookies.get("aether_refresh")?.value
  const goToken = req.cookies.get("aether_go_token")?.value

  // Bypasses check for standard public paths except login/signup which require validation
  if (isPublic(pathname) && pathname !== "/login" && pathname !== "/signup") {
    return NextResponse.next()
  }

  const secret = await makeSecret().catch(() => null)
  if (!secret) return NextResponse.next() // misconfigured — let through

  // If visiting login/signup, redirect to dashboard if authenticated. Otherwise, clear stale cookies.
  if (pathname === "/login" || pathname === "/signup") {
    // Try to verify access token
    if (accessToken) {
      try {
        await jwtVerify(accessToken, secret, { issuer: "aether", audience: "aether:dashboard" })
        return NextResponse.redirect(new URL("/dashboard", req.url))
      } catch {
        // Expired/invalid access token, fall through to refresh
      }
    }

    // Try to verify NextAuth token
    try {
      const isSecure = process.env.NEXTAUTH_URL?.startsWith("https://") || req.nextUrl.protocol === "https:"
      const nextAuthToken = await getToken({ 
        req, 
        secret: process.env.NEXTAUTH_SECRET || "default_dev_secret",
        secureCookie: isSecure
      })
      if (nextAuthToken) {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
    } catch {
      // ignore
    }

    // Try silent refresh
    if (refreshToken && accessToken) {
      try {
        const { payload } = await jwtVerify(accessToken, secret, {
          issuer: "aether",
          audience: "aether:dashboard",
          clockTolerance: 60 * 60 * 24 * 7,
        })

        const sub = payload.sub as string
        const email = payload.email as string

        if (sub && email) {
          const newAccessToken = await new SignJWT({ email })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(sub)
            .setIssuedAt()
            .setIssuer("aether")
            .setAudience("aether:dashboard")
            .setExpirationTime(`${ACCESS_TTL_SEC}s`)
            .sign(secret)

          const isProd = process.env.NODE_ENV === "production"
          const response = NextResponse.redirect(new URL("/dashboard", req.url))
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
        console.error("Silent token refresh failed on login page:", err)
      }
    }

    // If cookies are present but invalid/expired, clear them to prevent redirect loops
    if (accessToken || refreshToken || goToken) {
      const response = NextResponse.next()
      response.cookies.delete("aether_access")
      response.cookies.delete("aether_refresh")
      response.cookies.delete("aether_go_token")
      return response
    }

    return NextResponse.next()
  }

  // Protected paths (dashboard, etc.)
  
  // ✅ 1. Access token is valid — let through immediately
  if (accessToken) {
    try {
      await jwtVerify(accessToken, secret, { issuer: "aether", audience: "aether:dashboard" })
      return NextResponse.next()
    } catch {
      // Expired or invalid — fall through to refresh
    }
  }

  // ✅ 1b. NextAuth session is valid — let through immediately
  try {
    const isSecure = process.env.NEXTAUTH_URL?.startsWith("https://") || req.nextUrl.protocol === "https:"
    const nextAuthToken = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET || "default_dev_secret",
      secureCookie: isSecure
    })
    if (nextAuthToken) {
      return NextResponse.next()
    }
  } catch (err) {
    // Ignore NextAuth token errors
  }

  // 🔄 2. Access token expired — try to silently re-issue using expired token's identity
  if (refreshToken && accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, secret, {
        issuer: "aether",
        audience: "aether:dashboard",
        clockTolerance: 60 * 60 * 24 * 7,
      })

      const sub = payload.sub as string
      const email = payload.email as string

      if (sub && email) {
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

// Ensure static assets and system paths are skipped by the middleware entirely
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}
