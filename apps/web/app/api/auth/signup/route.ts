import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { goFetch } from "@/lib/go-backend"
import { hashEmailPassword } from "@/lib/auth-hash"

const Body = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(4096),
})

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail("Invalid body", 400)
  const { email, password } = parsed.data

  try {
    const normalizedEmail = email.toLowerCase()
    const authHash = await hashEmailPassword(normalizedEmail, password)

    await goFetch<{ message: string; userId: number }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: normalizedEmail, authHash }),
    })

    // Generate salt for client-side ZK key derivation
    const saltBytes = new Uint8Array(16)
    crypto.getRandomValues(saltBytes)
    const salt_b64 = btoa(String.fromCharCode(...saltBytes))

    return ok({ user: { sub: normalizedEmail, email: normalizedEmail, salt_b64 } })
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("409")) {
      return fail("Email already registered", 409)
    }
    return fail(`CF Edge Error: ${msg}`, 500)
  }
}
