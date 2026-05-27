import { ok } from "@/lib/api"
import { clearAuthCookies } from "@/lib/auth"
import { cookies } from "next/headers"

export async function POST() {
  await clearAuthCookies()
  // Also clear the Go backend token cookie
  const jar = await cookies()
  jar.delete("aether_go_token")
  return ok({ ok: true })
}
