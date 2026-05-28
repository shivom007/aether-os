import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { setAuthCookies, signAccessToken, newRefreshToken } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { cookies } from "next/headers"

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(4096),
})

// Cookie name for storing the Go backend JWT
const GO_TOKEN_COOKIE = "aether_go_token"

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail("Invalid body", 400)
  const { email, password } = parsed.data

  try {
    // Hash the password for the Go backend (it expects authHash)
    const encoder = new TextEncoder()
    const data = encoder.encode(password + email.toLowerCase())
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const authHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // Authenticate with Go backend
    const goRes = await goFetch<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: email.toLowerCase(), authHash }),
    })

    // Generate a salt for client-side key derivation
    const saltBytes = new Uint8Array(16)
    crypto.getRandomValues(saltBytes)
    const salt_b64 = btoa(String.fromCharCode(...saltBytes))

    // Issue dashboard JWT cookies
    const userId = email.toLowerCase()
    const access = await signAccessToken({ sub: userId, email: email.toLowerCase() })
    const { token: refresh } = await newRefreshToken()
    await setAuthCookies(access, refresh)

    // Store the Go backend token in a separate cookie
    const jar = await cookies()
    jar.set(GO_TOKEN_COOKIE, goRes.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    })

    return ok({ user: { sub: userId, email: email.toLowerCase(), salt_b64 } })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes("Invalid credentials") || msg.includes("401")) {
      return fail("Invalid credentials", 401)
    }
    return fail(msg || "Login failed", 500)
  }
}
