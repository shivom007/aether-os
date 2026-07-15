/**
 * Provider uploader. All providers (S3, GCS, B2, Azure) are addressed via
 * their S3-compatible HTTP interface, signed with AWS SigV4. This lets a
 * single code path push shards to any of the four backend types.
 *
 * For production, swap in the native SDKs per provider — the signature of
 * `putShard` / `getShard` stays identical.
 */
import { createHash, createHmac } from "node:crypto"
import { sql } from "./db"
import { unwrapSecret } from "./crypto/server"
import type { ProviderType } from "./types"

interface ProviderCreds {
  id: string
  provider_type: ProviderType
  endpoint_url: string | null
  bucket: string
  region: string | null
  access_key: string
  secret_key: string
}

export async function loadProvider(id: string): Promise<ProviderCreds | null> {
  const rows = (await sql`
    SELECT id, provider_type, endpoint_url, bucket, region, encrypted_access_token
    FROM provider_credentials WHERE id = ${id}
  `) as Array<{
    id: string
    provider_type: ProviderType
    endpoint_url: string | null
    bucket: string
    region: string | null
    encrypted_access_token: Buffer | Uint8Array
  }>
  if (rows.length === 0) return null
  const r = rows[0]
  const raw = unwrapSecret(Buffer.from(r.encrypted_access_token))
  const { access_key, secret_key } = JSON.parse(raw.toString("utf8")) as { access_key: string; secret_key: string }
  return { ...r, access_key, secret_key }
}

function hex(buf: Buffer | Uint8Array) {
  return Buffer.from(buf).toString("hex")
}
function sha256hex(data: Buffer | Uint8Array | string) {
  return createHash("sha256").update(data).digest("hex")
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest()
}

function deriveSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secret, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, "aws4_request")
}

function endpointUrl(c: ProviderCreds): string {
  if (c.endpoint_url && c.endpoint_url.length > 0) return c.endpoint_url.replace(/\/+$/, "")
  const region = c.region || "us-east-1"
  return `https://s3.${region}.amazonaws.com`
}

function amzDate(d = new Date()): { amz: string; date: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "")
  return { amz: iso, date: iso.slice(0, 8) }
}

async function signedRequest(
  c: ProviderCreds,
  method: "PUT" | "GET" | "HEAD",
  objectKey: string,
  body: Uint8Array | "" = "",
): Promise<{ url: string; headers: Record<string, string> }> {
  const base = endpointUrl(c)
  const host = new URL(base).host
  const canonicalUri = `/${encodeURIComponent(c.bucket)}/${objectKey
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`
  const { amz, date } = amzDate()
  const region = c.region || "us-east-1"
  const payloadHash = sha256hex(body === "" ? "" : Buffer.from(body))
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  }
  const signedHeaders = Object.keys(headers).sort().join(";")
  const canonicalHeaders =
    Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}`)
      .join("\n") + "\n"
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n")
  const credScope = `${date}/${region}/s3/aws4_request`
  const stringToSign = ["AWS4-HMAC-SHA256", amz, credScope, sha256hex(canonicalRequest)].join("\n")
  const signingKey = deriveSigningKey(c.secret_key, date, region, "s3")
  const signature = hex(hmac(signingKey, stringToSign))
  headers["authorization"] =
    `AWS4-HMAC-SHA256 Credential=${c.access_key}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { url: `${base}${canonicalUri}`, headers }
}

export async function putShard(c: ProviderCreds, objectKey: string, body: Uint8Array): Promise<void> {
  const { url, headers } = await signedRequest(c, "PUT", objectKey, body)
  const res = await fetch(url, { method: "PUT", headers, body })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Upload failed to ${c.provider_type}:${c.bucket}/${objectKey} (${res.status}): ${text.slice(0, 200)}`)
  }
}

export async function getShard(c: ProviderCreds, objectKey: string): Promise<Uint8Array> {
  const { url, headers } = await signedRequest(c, "GET", objectKey)
  const res = await fetch(url, { method: "GET", headers })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function headBucket(c: ProviderCreds): Promise<boolean> {
  try {
    const { url, headers } = await signedRequest(c, "HEAD", "")
    // HEAD bucket — path is /bucket/
    const bucketUrl = url.replace(/\/$/, "")
    const res = await fetch(bucketUrl, { method: "HEAD", headers })
    return res.ok || res.status === 403 // 403 = exists but no list perm, still "alive"
  } catch {
    return false
  }
}
