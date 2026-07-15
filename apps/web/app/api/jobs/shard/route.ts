import type { NextRequest } from "next/server"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { getGoAssertion } from "@/lib/bff-assertion"

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()

  try {
    const GO_API_BASE = process.env.GO_API_URL || "http://localhost:8080/api/v1"
    
    // Buffer the stream in memory (1MB max per shard) to prevent Node.js fetch ECONNRESET bugs
    // with duplex streaming.
    const bodyBuffer = await req.arrayBuffer();

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${token}`);
    
    const contentType = req.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);

    const response = await fetch(`${GO_API_BASE}/shards/upload`, {
      method: "POST",
      headers: headers,
      body: bodyBuffer,
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "Upload failed")
      throw new Error(`Go backend returned ${response.status}: ${errText}`)
    }

    return ok({ status: "success" })
  } catch (err) {
    console.error("Shard proxy upload error:", err)
    return fail((err as Error).message, 500)
  }
}
