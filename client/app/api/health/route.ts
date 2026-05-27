import { ok } from "@/lib/api"

export async function GET() {
  // Check Go backend health
  let backend_ok = true
  try {
    const GO_API_BASE = process.env.GO_API_URL || "http://localhost:8080"
    const res = await fetch(`${GO_API_BASE}/health`, { cache: "no-store" })
    backend_ok = res.ok
  } catch {
    backend_ok = false
  }

  return ok({
    db_ok: backend_ok,
    queue_depth: 0,
    worker_pool_paused: false,
    subject: backend_ok ? "aether.alerts.ok" : "aether.alerts.backend_unavailable",
    message: backend_ok ? undefined : "Go backend unavailable",
  })
}
