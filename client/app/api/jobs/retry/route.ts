import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"

export async function POST() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  // Retry stub — jobs are handled by Go backend
  return ok({ retried: 0 })
}
