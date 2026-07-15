import type { NextRequest } from "next/server"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * SSE bridge stub. Returns an empty event stream with heartbeat.
 * Events will be implemented when the Go backend supports them.
 */
export async function GET(req: NextRequest) {
  const s = await getSession()
  if (!s) return new Response("unauthorized", { status: 401 })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const cleanup = () => {
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      req.signal.addEventListener("abort", cleanup)

      controller.enqueue(encoder.encode(`: connected\n\n`))

      const hb = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: hb\n\n`))
        } catch {
          cleanup()
        }
      }, 15_000)

      // Just keep alive until client disconnects
      try {
        while (!closed) {
          await new Promise((r) => setTimeout(r, 5000))
        }
      } finally {
        clearInterval(hb)
        cleanup()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  })
}
