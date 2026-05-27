import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"

export async function GET() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)

  // Workers stub — returns empty data (workers are handled by Go backend)
  return ok({
    workers: [],
    paused: false,
    recent_jobs: [],
  })
}
