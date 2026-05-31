import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"
import { toFolderInodeID, toGoID } from "@/lib/inodes"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const { id } = await ctx.params
  const token = await getGoToken()

  try {
    const file = await goFetch<{
      id: number
      volumeId: string
      folderId?: number | null
      name: string
      size: number
      mimeType: string
      thumbnail?: string
      createdAt: string
      updatedAt: string
      versions?: Array<{
        id: number
        chunks?: Array<{
          id: number
          chunkIndex: number
          shards?: Array<{
            id: number
            shardIndex: number
            provider: string
            providerFileId: string
            status: string
          }>
        }>
      }>
    }>(`/fs/file/${id}`, { token })

    const inode = {
      id: String(file.id),
      volume_id: file.volumeId,
      parent_id: file.folderId ? toFolderInodeID(file.folderId) : null,
      name: file.name,
      kind: "file" as const,
      size_bytes: file.size,
      mime_type: file.mimeType,
      thumbnail_b64: file.thumbnail || null,
      materialized_path: "/" + file.name,
      created_at: file.createdAt,
      updated_at: file.updatedAt,
    }

    // Map shards to chunks format expected by dashboard
    const chunks = (file.versions?.[0]?.chunks || []).flatMap((chunk) =>
      (chunk.shards || []).map((shard) => ({
        id: String(shard.id),
        inode_id: String(file.id),
        chunk_index: chunk.chunkIndex,
        shard_index: shard.shardIndex,
        provider_id: shard.provider,
        provider_type: shard.provider,
        remote_object_id: shard.providerFileId,
        checksum_sha256: "",
        size_bytes: 0,
        created_at: file.createdAt,
      }))
    )

    return ok({ inode, chunks })
  } catch (err) {
    console.error("[DEBUG] Error in /api/inodes/[id]:", err)
    return fail((err as Error).message, 404)
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const { id } = await ctx.params
  const token = await getGoToken()

  try {
    const goID = toGoID(id)
    if (id.startsWith("folder-")) {
      await goFetch(`/fs/folder/${goID}`, { method: "DELETE", token })
    } else {
      await goFetch(`/fs/file/${goID}`, { method: "DELETE", token })
    }
    return ok({ deleted: id })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
