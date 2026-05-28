import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"

export async function GET() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoToken()

  try {
    const latencies = await goFetch<Record<string, number>>("/providers/latency", { token })
    return ok(latencies)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
