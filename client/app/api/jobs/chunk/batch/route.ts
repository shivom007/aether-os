import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { getGoToken } from "@/lib/go-token"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoToken()

  try {
    const GO_API_BASE = process.env.GO_API_URL || "http://localhost:8080/api/v1"
    
    // Stream the request body directly to the Go backend
    // This bypasses the Vercel 4.5MB Serverless Function payload limit
    const response = await fetch(`${GO_API_BASE}/shards/upload/batch`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": req.headers.get("Content-Type") || "multipart/form-data",
      },
      body: req.body,
      // @ts-ignore - Required for node fetch to support streaming bodies
      duplex: "half",
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
