import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"

/**
 * Prometheus query stub. Returns empty series for now.
 * Observability will be implemented when the Go backend exposes metrics.
 */
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)

  // Return empty series for all queries
  return ok({ series: [] })
}
