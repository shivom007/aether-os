import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"
import { toFolderInodeID, toGoID } from "@/lib/inodes"
import type { Inode } from "@/lib/types"

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoToken()
  const { id } = await ctx.params
  const parentID = toGoID(req.nextUrl.searchParams.get("parent_id"))
  const fsPath = parentID
    ? `/fs?volumeId=${encodeURIComponent(id)}&parentId=${encodeURIComponent(parentID)}`
    : `/fs?volumeId=${encodeURIComponent(id)}`

  try {
    const fsData = await goFetch<{
      files: Array<{ id: number; name: string; size: number; mimeType: string; thumbnail?: string; folderId?: number | null; createdAt: string; updatedAt: string }> | null
      folders: Array<{ id: number; name: string; parentId?: number | null; createdAt: string; updatedAt: string }> | null
    }>(fsPath, { token })

    const files = fsData.files || []
    const folders = fsData.folders || []

    const inodes: Inode[] = [
      ...folders.map((f) => ({
        id: toFolderInodeID(f.id),
        volume_id: id,
        parent_id: f.parentId ? toFolderInodeID(f.parentId) : null,
        name: f.name,
        kind: "dir" as const,
        size_bytes: 0,
        mime_type: null,
        materialized_path: "/" + f.name,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
      })),
      ...files.map((f) => ({
        id: String(f.id),
        volume_id: id,
        parent_id: f.folderId ? toFolderInodeID(f.folderId) : null,
        name: f.name,
        kind: "file" as const,
        size_bytes: f.size,
        mime_type: f.mimeType,
        thumbnail_b64: f.thumbnail || null,
        materialized_path: "/" + f.name,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
      })),
    ]

    return ok({ inodes, root_id: "root" })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
