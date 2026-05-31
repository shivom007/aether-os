import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const { id } = await ctx.params
  const token = await getGoToken()

  try {
    const result = await goFetch<{ status: string; latencyMs: number }>(
      `/providers/${id}/health`,
      { method: "POST", token }
    )
    return ok(result)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}