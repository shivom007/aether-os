import { SignJWT } from "jose"
import { getServerSession } from "next-auth"
import { authOptions } from "./auth-options"

const BFF_ASSERTION_ISSUER = "aether-web"
const BFF_ASSERTION_AUDIENCE = "aether-api"
const BFF_ASSERTION_TTL_SECONDS = 60

function getBFFAssertionSecret() {
  const secret = process.env.AETHER_BFF_JWT_SECRET || process.env.AUTH_JWT_SECRET
  if (!secret) {
    throw new Error("AETHER_BFF_JWT_SECRET or AUTH_JWT_SECRET is not configured")
  }
  return new TextEncoder().encode(secret)
}

export async function getGoAssertion(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return null

  const issuedAt = Math.floor(Date.now() / 1000)
  return new SignJWT({ token_use: "bff" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(BFF_ASSERTION_ISSUER)
    .setAudience(BFF_ASSERTION_AUDIENCE)
    .setSubject(email)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + BFF_ASSERTION_TTL_SECONDS)
    .sign(getBFFAssertionSecret())
}
