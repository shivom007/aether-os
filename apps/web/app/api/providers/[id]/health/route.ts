import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import type { GoProviderHealthResponse } from "@/lib/types"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const { id } = await ctx.params
  const token = await getGoAssertion()

  try {
    const result = await goFetch<GoProviderHealthResponse>(
      `/providers/${id}/health`,
      { method: "POST", token }
    )
    return ok(result)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
