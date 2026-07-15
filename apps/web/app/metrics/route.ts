import { renderPromText } from "@/lib/metrics"

export const dynamic = "force-dynamic"

export async function GET() {
  const body = await renderPromText()
  return new Response(body, {
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
  })
}
