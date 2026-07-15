import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import type { GoProviderLatencyResponse, ProviderLatencyResult } from "@/lib/types"

export async function GET() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()

  try {
    const latencies = await goFetch<GoProviderLatencyResponse>("/providers/latency", { token })
    const mapped: Record<string, ProviderLatencyResult> = Object.fromEntries(
      Object.entries(latencies).map(([id, result]) => [
        id,
        {
          latencyMs: result.latencyMs,
          status: (result.status as ProviderLatencyResult["status"]) ?? "unknown",
        },
      ]),
    )
    return ok(mapped)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
