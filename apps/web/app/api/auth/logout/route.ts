import { ok } from "@/lib/api"
import { clearLegacyAuthCookies } from "@/lib/auth"

export async function POST() {
  await clearLegacyAuthCookies()
  return ok({ ok: true })
}
