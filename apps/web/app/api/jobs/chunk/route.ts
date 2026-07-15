import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import type { GoAllocateShardRequest, GoAllocateShardResponse } from "@/lib/types"

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
  const token = await getGoAssertion()

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
    const goBody: GoAllocateShardRequest = {
      fileVersionId,
      chunkIndex,
      chunkSize,
    }

    // Step 1: Allocate shards via Go backend
    const resp = await goFetch<GoAllocateShardResponse>("/shards/allocate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(goBody)
    })

    return ok({ allocation: resp.allocation })
  } catch (err: any) {
    console.error("Chunk allocation proxy error:", err)
    return fail(err.message || "Failed to allocate shards", 500)
  }
}
