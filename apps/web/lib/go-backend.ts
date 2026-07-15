/**
 * Helper to call the Go backend API from Next.js server-side routes.
 * Protected calls use a short-lived Bearer assertion minted by the web BFF.
 */

function getGoApiBase() {
  return process.env.GO_API_URL || "http://localhost:8080/api/v1"
}

export interface GoBackendOptions extends RequestInit {
  token?: string | null
}

export async function goFetch<T = unknown>(path: string, opts: GoBackendOptions = {}): Promise<T> {
  const { token, ...init } = opts
  const url = `${getGoApiBase()}${path}`

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> || {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  // Only add Content-Type for JSON bodies (not FormData/binary)
  if (init.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json"
  }

  const res = await fetch(url, { ...init, headers })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw Object.assign(new Error(text), { status: res.status })
  }

  // Some endpoints return no content (204)
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return {} as T
  }

  return res.json()
}

/**
 * Fetch binary data (e.g., shard download) from Go backend
 */
export async function goFetchBinary(path: string, token?: string | null): Promise<ArrayBuffer> {
  const url = `${getGoApiBase()}${path}`
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw Object.assign(new Error(text), { status: res.status })
  }
  return res.arrayBuffer()
}

/**
 * Fetch binary data as a readable stream from Go backend
 */
export async function goFetchStream(path: string, token?: string | null): Promise<ReadableStream<Uint8Array> | null> {
  const url = `${getGoApiBase()}${path}`
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw Object.assign(new Error(text), { status: res.status })
  }
  return res.body
}
