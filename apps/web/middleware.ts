import { NextResponse, type NextRequest } from "next/server"
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
  "/_vercel",
]

const LEGACY_COOKIES = ["aether_access", "aether_refresh", "aether_go_token"] as const

function isPublic(pathname: string) {
  if (pathname === "/") return true
  return PUBLIC_PATHS.some((p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p)))
}

function getNextAuthSecret() {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET
  if (process.env.NODE_ENV !== "production") return "default_dev_secret"
  return undefined
}

function clearLegacyCookies(response: NextResponse) {
  for (const name of LEGACY_COOKIES) response.cookies.delete(name)
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname) && pathname !== "/login" && pathname !== "/signup") {
    return NextResponse.next()
  }

  const secret = getNextAuthSecret()
  const isSecure = process.env.NEXTAUTH_URL?.startsWith("https://") || req.nextUrl.protocol === "https:"
  const token = secret
    ? await getToken({
        req,
        secret,
        secureCookie: isSecure,
      }).catch(() => null)
    : null

  const hasAuth = Boolean(token)

  if (pathname === "/login" || pathname === "/signup") {
    if (hasAuth) return NextResponse.redirect(new URL("/dashboard", req.url))

    const response = NextResponse.next()
    clearLegacyCookies(response)
    return response
  }

  if (hasAuth) return NextResponse.next()

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", pathname)
  const response = NextResponse.redirect(url)
  clearLegacyCookies(response)
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*).*)"],
}
