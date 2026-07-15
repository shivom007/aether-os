import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"

const Body = z.object({ paused: z.boolean() })

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail("Invalid body", 400)

  // Workers pause stub
  return ok({ paused: parsed.data.paused })
}
