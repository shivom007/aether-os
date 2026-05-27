import type { NextRequest } from "next/server"
import { fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch, goFetchBinary } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const { id } = await ctx.params
  const token = await getGoToken()

  try {
    const buffer = await goFetchBinary(`/shards/download/${id}`, token)
    
    console.log(`[DEBUG] Shard ${id} downloaded: ${buffer.byteLength} bytes. First 4 bytes:`, new Uint8Array(buffer.slice(0, 4)))
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buffer.byteLength),
      },
    })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
