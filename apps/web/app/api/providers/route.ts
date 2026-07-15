import type { NextRequest } from "next/server"
import { z } from "zod"
import { ok, fail } from "@/lib/api"
import { getSession } from "@/lib/auth"
import { goFetch } from "@/lib/go-backend"
import { getGoAssertion } from "@/lib/bff-assertion"
import type {
  GoLinkProviderRequest,
  GoLinkProviderResponse,
  GoProvider,
  GoProviderHealthResponse,
  ProviderCredential,
} from "@/lib/types"

export async function GET() {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()

  try {
    const providers = await goFetch<GoProvider[]>("/providers", { token })

    const mapped: ProviderCredential[] = providers.map((p) => ({
      id: String(p.id),
      owner_id: s.sub,
      provider_type: mapProviderType(p.providerType),
      endpoint_url: p.endpointUrl || null,
      bucket: p.bucket,
      region: p.region || null,
      status: (p.status as ProviderCredential["status"]) ?? "unknown",
      last_checked_at: p.lastCheckedAt || null,
      created_at: p.createdAt,
    }))

    return ok(mapped)
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}

function mapProviderType(provider: string): "s3" | "gcs" | "azure" | "b2" | "gdrive" | "dropbox" {
  if (provider === "gcs") return "gcs"
  if (provider === "b2") return "b2"
  if (provider === "azure") return "azure"
  if (provider === "GoogleDrive" || provider === "gdrive") return "gdrive"
  if (provider === "Dropbox" || provider === "dropbox") return "dropbox"
  return "s3"
}

const Body = z.object({
  provider_type: z.enum(["s3", "gcs", "azure", "b2"]),
  endpoint_url: z.string().url().max(500).optional().nullable(),
  bucket: z.string().min(1).max(255),
  region: z.string().max(100).optional().nullable(),
  access_key: z.string().min(1).max(500),
  secret_key: z.string().min(1).max(2000),
})

export async function POST(req: NextRequest) {
  const s = await getSession()
  if (!s) return fail("unauthorized", 401)
  const token = await getGoAssertion()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Invalid body", 400)
  const { provider_type, bucket, region, access_key, secret_key } = parsed.data

  try {
    const goBody: GoLinkProviderRequest = {
      accessKey: access_key,
      secretKey: secret_key,
      region: region || "us-east-1",
      bucket,
      endpointUrl: parsed.data.endpoint_url || "",
      providerType: provider_type,
    }

    const result = await goFetch<GoLinkProviderResponse>("/providers/aws", {
      method: "POST",
      token,
      body: JSON.stringify(goBody),
    })

    let initialStatus: ProviderCredential["status"] = "unknown"
    let lastCheckedAt: string | null = null
    try {
      const health = await goFetch<GoProviderHealthResponse>(
        `/providers/${result.id}/health`,
        { method: "POST", token }
      )
      initialStatus = (health.status as ProviderCredential["status"]) ?? "unknown"
      lastCheckedAt = new Date().toISOString()
    } catch {
      initialStatus = "unhealthy"
      lastCheckedAt = new Date().toISOString()
    }

    return ok({
      id: String(result.id),
      owner_id: s.sub,
      provider_type,
      endpoint_url: parsed.data.endpoint_url || null,
      bucket,
      region,
      status: initialStatus,
      last_checked_at: lastCheckedAt,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    return fail((err as Error).message, 500)
  }
}
