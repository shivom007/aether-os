import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoToken } from "@/lib/go-token"

/**
 * Chunk upload endpoint proxied to Go backend.
 * Headers:
 *   X-Aether-Inode-Id    → file ID
 *   X-Aether-Chunk-Index → chunk index (0-based)
 *   X-Aether-Version-Id  → optional file version ID
 * Body = encrypted ciphertext
 */
export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoToken()

  const inodeId = req.headers.get("x-aether-inode-id")
  if (!inodeId) return fail("Missing file id", 400)
  
  const fileVersionId = Number.parseInt(req.headers.get("x-aether-version-id") || "", 10)
  const chunkIndexRaw = req.headers.get("x-aether-chunk-index") || ""
  const chunkIndex = Number.parseInt(chunkIndexRaw, 10)
  if (!Number.isFinite(chunkIndex) || chunkIndex < 0) return fail("Invalid chunk index", 400)

  const chunkSizeRaw = req.headers.get("x-aether-chunk-size") || ""
  const chunkSize = Number.parseInt(chunkSizeRaw, 10)
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) return fail("Invalid chunk size", 400)

  try {
    // Step 1: Allocate shards via Go backend
    const allocation = await goFetch<{
      chunkId: number
      allocations: Array<{
        shardId: number
        shardIndex: number
        provider: string
      }>
    }>("/shards/allocate", {
      method: "POST",
      token,
      body: JSON.stringify({
        fileVersionId: fileVersionId || 0,
        chunkIndex,
        chunkSize,
      }),
    })

    return ok({
      job_id: `job-${inodeId}-${chunkIndex}`,
      status: "allocated",
      allocation,
    })
  } catch (err) {
    console.error("Chunk allocation error:", err)
    return fail((err as Error).message, 500)
  }
}
