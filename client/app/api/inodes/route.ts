import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"
import type { Inode } from "@/lib/types"

const Body = z.object({
  volume_id: z.string(),
  parent_id: z.string().nullable().optional(),
  name: z.string().min(1).max(512),
  kind: z.enum(["file", "dir"]),
  size_bytes: z.number().int().min(0).default(0),
  mime_type: z.string().max(255).nullable().optional(),
  thumbnail: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoToken()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid body", 400)
  const { volume_id, parent_id, name, kind, size_bytes, mime_type, thumbnail } = parsed.data

  try {
    if (kind === "dir") {
      // Create folder in Go backend
      const result = await goFetch<{ id: number; name: string }>("/fs/folder", {
        method: "POST",
        token,
        body: JSON.stringify({ name, parentId: parent_id ? parseInt(parent_id) : null, volumeId: volume_id }),
      })
      const inode: Inode = {
        id: String(result.id),
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
    const result = await goFetch<{ file: { id: number; name: string; size: number; mimeType: string; createdAt: string }; versionId: number }>(
      "/fs/file",
      {
        method: "POST",
        token,
        body: JSON.stringify({ name, size: size_bytes, mimeType: mime_type || "application/octet-stream", parentId: parent_id ? parseInt(parent_id) : null, volumeId: volume_id, thumbnail }),
      }
    )

    const inode: Inode = {
      id: String(result.file.id),
      volume_id: "default",
      parent_id: null,
      name: result.file.name,
      kind: "file",
      size_bytes: result.file.size,
      mime_type: result.file.mimeType,
      materialized_path: "/" + result.file.name,
      created_at: result.file.createdAt,
      updated_at: result.file.createdAt,
    }

    return ok({ ...inode, versionId: result.versionId })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
