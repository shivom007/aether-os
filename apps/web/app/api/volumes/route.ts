import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import type { GoCreateVolumeRequest, GoVolume, Volume } from "@/lib/types"

export async function GET() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()

  try {
    const volumes = await goFetch<GoVolume[]>("/volumes", { token })

    const formattedVolumes: Volume[] = volumes.map(v => ({
      id: v.id,
      owner_id: String(v.userId),
      name: v.name,
      description: v.description,
      master_key_fingerprint: v.masterKeyFingerprint,
      kdf_salt: v.kdfSalt,
      created_at: v.createdAt,
      logical_size_bytes: 0, // We can aggregate this later if needed
      inode_count: 0,
    }))

    return ok(formattedVolumes)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}

const Body = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional().nullable(),
  kdf_salt: z.string().min(8),
  master_key_fingerprint: z.string().min(10).max(200).optional(),
})

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid body", 400)
  const { name, description, kdf_salt, master_key_fingerprint } = parsed.data

  // Generate a random ID for the volume since the client doesn't send one
  const volId = crypto.randomUUID()

  try {
    const goBody: GoCreateVolumeRequest = {
      id: volId,
      name,
      description: description || "",
      master_key_fingerprint: master_key_fingerprint || "unverified",
      kdf_salt,
    }

    const result = await goFetch<GoVolume>("/volumes", {
      method: "POST",
      token,
      body: JSON.stringify(goBody),
    })

    const newVolume: Volume = {
      id: result.id,
      owner_id: s.sub,
      name: result.name,
      description: result.description,
      master_key_fingerprint: result.masterKeyFingerprint,
      kdf_salt: result.kdfSalt,
      created_at: result.createdAt,
      logical_size_bytes: 0,
      inode_count: 0,
    }

    return ok(newVolume)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
