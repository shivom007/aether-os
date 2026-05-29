import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { getGoToken } from "@/lib/go-token"

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoToken()

  try {
    const formData = await req.formData()
    
    // Validate we actually received shards
    let hasShards = false
    for (const key of formData.keys()) {
      if (key.startsWith("shard_")) {
        hasShards = true
        break
      }
    }

    if (!hasShards) {
      return fail("No shards found in batch upload", 400)
    }

    const GO_API_BASE = process.env.GO_API_URL || "http://localhost:8080/api/v1"
    
    // We recreate the FormData to ensure clean boundary and headers to Go
    const goFormData = new FormData()
    for (const [key, value] of formData.entries()) {
      goFormData.append(key, value)
    }

    const response = await fetch(`${GO_API_BASE}/shards/upload/batch`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      body: goFormData,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "Upload failed")
      throw new Error(`Go backend returned ${response.status}: ${errText}`)
    }

    return ok({ status: "success" })
  } catch (err) {
    console.error("Batch proxy upload error:", err)
    return fail((err as Error).message, 500)
  }
}
