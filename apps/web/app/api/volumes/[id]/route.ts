import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import type { Volume } from "@/lib/types"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()
  const { id } = await ctx.params
  const url = new URL(req.url)

  if (url.searchParams.get("shards")) {
    // Return empty shard distribution for chunk map visualization
    return ok([])
  }

  try {
    const volumes = await goFetch<any[]>("/volumes", { token })
    const volume = volumes.find(v => v.id === id)
    
    if (!volume) {
      return fail("Volume not found", 404)
    }

    // Optionally fetch files to get total size and inode count for this specific volume
    const fsData = await goFetch<{ files: Array<{ id: number; size: number }> | null }>(`/fs?volumeId=${id}`, { token })
    const files = fsData.files || []
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)

    return ok({
      id: volume.id,
      owner_id: s.sub,
      name: volume.name,
      description: volume.description,
      master_key_fingerprint: volume.masterKeyFingerprint,
      kdf_salt: volume.kdfSalt,
      created_at: volume.createdAt,
      logical_size_bytes: totalSize,
      inode_count: files.length,
    })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}

const PatchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()
  const { id } = await ctx.params

  const parsed = PatchBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid body", 400)
  
  try {
    const updated = await goFetch<any>(`/volumes/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(parsed.data)
    })
    return ok(updated)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()
  const { id } = await ctx.params
  
  try {
    await goFetch(`/volumes/${id}`, { method: "DELETE", token })
    return ok({ deleted: id })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
