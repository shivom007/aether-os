import type { NextRequest } from "next/server"
import { fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetchStream } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const { id } = await ctx.params
  const token = await getGoAssertion()

  try {
    const stream = await goFetchStream(`/shards/download/${id}`, token)
    
    return new Response(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
    })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
