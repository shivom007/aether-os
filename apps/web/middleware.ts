import { NextResponse, type NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/api/auth",
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
  return process.env.NEXTAUTH_SECRET
}

function clearLegacyCookies(response: NextResponse) {
  for (const name of LEGACY_COOKIES) response.cookies.delete(name)
}

async function handleRequest(req: NextRequest, response: NextResponse) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname) && pathname !== "/login" && pathname !== "/signup") {
    return response
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
    if (hasAuth) {
      const redirectRes = NextResponse.redirect(new URL("/dashboard", req.url))
      redirectRes.headers.set("Content-Security-Policy", response.headers.get("Content-Security-Policy") || "")
      redirectRes.headers.set("x-nonce", response.headers.get("x-nonce") || "")
      return redirectRes
    }

    clearLegacyCookies(response)
    return response
  }

  if (hasAuth) return response

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401, headers: response.headers })
  }

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", pathname)
  const redirectRes = NextResponse.redirect(url)
  redirectRes.headers.set("Content-Security-Policy", response.headers.get("Content-Security-Policy") || "")
  redirectRes.headers.set("x-nonce", response.headers.get("x-nonce") || "")
  clearLegacyCookies(redirectRes)
  return redirectRes
}

export async function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV !== "production"
  
  // In development, Next.js requires unsafe-inline and unsafe-eval for Fast Refresh
  const csp = isDev 
    ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'`
    : `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'`

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set("Content-Security-Policy", csp)
  response.headers.set("x-nonce", nonce)

  return handleRequest(req, response)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|apple-icon.*|sw\\.js|.*\\.wasm).*)"],
}
