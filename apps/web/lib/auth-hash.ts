function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return toHex(hashBuffer)
}

export async function hashEmailPassword(email: string, password: string): Promise<string> {
  return sha256Hex(`${password}${email.toLowerCase()}`)
}

export async function hashOAuthIdentity(provider: string, providerAccountId: string): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set")
  return sha256Hex(`${providerAccountId}${provider}${secret}`)
}
