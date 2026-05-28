import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { setAuthCookies, signAccessToken, newRefreshToken } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { cookies } from "next/headers"

const Body = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(4096),
})

const GO_TOKEN_COOKIE = "aether_go_token"

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail("Invalid body", 400)
  const { email, password } = parsed.data

  try {
    // Hash the password for the Go backend
    const encoder = new TextEncoder()
    const data = encoder.encode(password + email.toLowerCase())
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const authHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // Step 1: Register with Go backend
    await goFetch<{ message: string; userId: number }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: email.toLowerCase(), authHash }),
    })

    // Step 2: Login to get a JWT token (Go register doesn't return one)
    const loginRes = await goFetch<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: email.toLowerCase(), authHash }),
    })

    // Generate salt for client-side ZK key derivation
    const saltBytes = new Uint8Array(16)
    crypto.getRandomValues(saltBytes)
    const salt_b64 = btoa(String.fromCharCode(...saltBytes))

    // Issue dashboard JWT cookies
    const userId = email.toLowerCase()
    const access = await signAccessToken({ sub: userId, email: email.toLowerCase() })
    const { token: refresh } = await newRefreshToken()
    await setAuthCookies(access, refresh)

    // Store Go backend JWT
    const jar = await cookies()
    jar.set(GO_TOKEN_COOKIE, loginRes.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    })

    return ok({ user: { sub: userId, email: email.toLowerCase(), salt_b64 } })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("409")) {
      return fail("Email already registered", 409)
    }
    return fail(msg || "Signup failed", 500)
  }
}
