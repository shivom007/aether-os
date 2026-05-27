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
]

function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get("aether_access")?.value
  const secret = process.env.AUTH_JWT_SECRET
  let valid = false
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "aether", audience: "aether:dashboard" })
      valid = true
    } catch (err) {
      console.error("JWT verify failed:", err)
      valid = false
    }
  } else {
    console.error("Missing token or secret. Token exists:", !!token, "Secret exists:", !!secret)
  }

  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}
