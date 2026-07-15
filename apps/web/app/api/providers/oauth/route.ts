import { NextRequest, NextResponse } from "next/server"
import { getGoAssertion } from "@/lib/bff-assertion"
import { goFetch } from "@/lib/go-backend"
import type { GoOAuthSessionRequest, GoOAuthSessionResponse } from "@/lib/types"

export async function GET(req: NextRequest) {
  const token = await getGoAssertion()
  if (!token) return NextResponse.redirect(new URL("/login", req.url))

  const provider = req.nextUrl.searchParams.get("provider")
  if (provider === "google" || provider === "dropbox") {
    try {
      const body: GoOAuthSessionRequest = { provider }

      // Securely fetch an ephemeral session ID using the HttpOnly JWT token
      const res = await goFetch<GoOAuthSessionResponse>("/providers/oauth/session", {
        method: "POST",
        token,
        body: JSON.stringify(body)
      })

      // IMPORTANT: This redirect goes to the BROWSER, so we MUST use the public backend URL.
      // GO_API_URL is the internal Railway URL and is unreachable from the public internet.
      const PUBLIC_GO_API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1"
      const frontendOrigin = process.env.NEXTAUTH_URL || req.nextUrl.origin
      const returnTo = encodeURIComponent(frontendOrigin)
      return NextResponse.redirect(`${PUBLIC_GO_API_BASE}/providers/${provider}/auth?session_id=${res.sessionId}&returnTo=${returnTo}`)
    } catch (err) {
      console.error("Failed to create OAuth session:", err)
      return NextResponse.redirect(new URL("/dashboard/providers?error=session_failed", req.url))
    }
  }

  return NextResponse.redirect(new URL("/dashboard/providers", req.url))
}
