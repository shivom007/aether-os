import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import { toFolderInodeID, toGoNumericID } from "@/lib/inodes"
import { MediaMetadataSchema, serializeMediaMetadata } from "@/lib/media/metadata"
import type {
  GoCreateFileRequest,
  GoCreateFileResponse,
  GoCreateFolderRequest,
  GoCreateFolderResponse,
  Inode,
} from "@/lib/types"

const Body = z.object({
  volume_id: z.string(),
  parent_id: z.string().nullable().optional(),
  name: z.string().min(1).max(512),
  kind: z.enum(["file", "dir"]),
  size_bytes: z.number().int().min(0).default(0),
  mime_type: z.string().max(255).nullable().optional(),
  media_metadata: MediaMetadataSchema.nullable().optional(),
  thumbnail: z.string().optional(),
  fingerprint: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid body", 400)
  const { volume_id, parent_id, name, kind, size_bytes, mime_type, media_metadata, thumbnail, fingerprint } = parsed.data

  try {
    if (kind === "dir") {
      const parentId = toGoNumericID(parent_id)
      const goBody: GoCreateFolderRequest = { name, parentId, volumeId: volume_id }

      // Create folder in Go backend
      const result = await goFetch<GoCreateFolderResponse>("/fs/folder", {
        method: "POST",
        token,
        body: JSON.stringify(goBody),
      })
      const inode: Inode = {
        id: toFolderInodeID(result.id),
        volume_id: volume_id,
        parent_id: parent_id || null,
        name: result.name,
        kind: "dir",
        size_bytes: 0,
        mime_type: null,
        materialized_path: "/" + result.name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return ok(inode)
    }

    // Register file in Go backend
    const parentId = toGoNumericID(parent_id)
    const goBody: GoCreateFileRequest = {
      name,
      size: size_bytes,
      mimeType: mime_type || "application/octet-stream",
      mediaMetadata: media_metadata ? serializeMediaMetadata(media_metadata) : undefined,
      folderId: parentId,
      volumeId: volume_id,
      thumbnail,
      fingerprint,
    }
    const result = await goFetch<GoCreateFileResponse>(
      "/fs/file",
      {
        method: "POST",
        token,
        body: JSON.stringify(goBody),
      }
    )

    const inode: Inode = {
      id: String(result.file.id),
      volume_id: result.file.volumeId || volume_id,
      parent_id: result.file.folderId ? toFolderInodeID(result.file.folderId) : null,
      name: result.file.name,
      kind: "file",
      size_bytes: result.file.size,
      mime_type: result.file.mimeType,
      media_metadata: media_metadata || null,
      thumbnail_b64: result.file.thumbnail || null,
      materialized_path: "/" + result.file.name,
      created_at: result.file.createdAt,
      updated_at: result.file.updatedAt || result.file.createdAt,
    }

    return ok({ ...inode, versionId: result.versionId, completedChunks: result.completedChunks || [] })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
