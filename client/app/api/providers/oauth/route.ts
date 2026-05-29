import { NextRequest, NextResponse } from "next/server"
import { getGoToken } from "@/lib/go-token"
import { goFetch } from "@/lib/go-backend"

export async function GET(req: NextRequest) {
  const token = await getGoToken()
  if (!token) return NextResponse.redirect(new URL("/login", req.url))

  const provider = req.nextUrl.searchParams.get("provider")
  if (provider === "google" || provider === "dropbox") {
    try {
      // Securely fetch an ephemeral session ID using the HttpOnly JWT token
      const res = await goFetch<{ sessionId: string }>("/providers/oauth/session", {
        method: "POST",
        token,
        body: JSON.stringify({ provider })
      })

      const GO_API_BASE = process.env.GO_API_URL || "http://localhost:8080/api/v1"
      const returnTo = encodeURIComponent(req.nextUrl.origin)
      return NextResponse.redirect(`${GO_API_BASE}/providers/${provider}/auth?session_id=${res.sessionId}&returnTo=${returnTo}`)
    } catch (err) {
      console.error("Failed to create OAuth session:", err)
      return NextResponse.redirect(new URL("/dashboard/providers?error=session_failed", req.url))
    }
  }

  return NextResponse.redirect(new URL("/dashboard/providers", req.url))
}
