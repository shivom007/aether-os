import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

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

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "aether", audience: "aether:dashboard" })
    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get("aether_access")?.value
  const refreshToken = req.cookies.get("aether_refresh")?.value
  const secret = process.env.AUTH_JWT_SECRET

  // ✅ Access token is valid — let through
  if (token && secret && await verifyToken(token, secret)) {
    return NextResponse.next()
  }

  // 🔄 Access token expired but refresh token exists — attempt silent refresh
  if (refreshToken) {
    try {
      const refreshUrl = new URL("/api/auth/refresh", req.url)
      const refreshRes = await fetch(refreshUrl.toString(), {
        method: "POST",
        headers: {
          // Forward the cookies so the refresh route can read them
          cookie: req.headers.get("cookie") || "",
        },
      })

      if (refreshRes.ok) {
        // Refresh succeeded — forward the new Set-Cookie headers and continue
        const response = NextResponse.next()
        const setCookieHeader = refreshRes.headers.getSetCookie?.() ?? 
          [refreshRes.headers.get("set-cookie")].filter(Boolean) as string[]
        
        for (const cookie of setCookieHeader) {
          response.headers.append("set-cookie", cookie)
        }
        return response
      }
    } catch (err) {
      console.error("Silent refresh failed:", err)
    }
  }

  // ❌ Both tokens missing or refresh failed — redirect to login
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
