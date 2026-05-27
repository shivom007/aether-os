import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"

export async function GET() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)

  // Return session info. salt_b64 is generated at login/signup and stored client-side
  return ok({ sub: s.sub, email: s.email, salt_b64: "" })
}
