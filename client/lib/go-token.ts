import { cookies } from "next/headers"

const GO_TOKEN_COOKIE = "aether_go_token"

/**
 * Get the stored Go backend JWT from cookies.
 * This is used by API routes that need to proxy requests to the Go backend.
 */
export async function getGoToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(GO_TOKEN_COOKIE)?.value ?? null
}
