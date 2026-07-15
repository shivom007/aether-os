import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GithubProvider from "next-auth/providers/github"
import { goFetch } from "@/lib/go-backend"
import { hashEmailPassword, hashOAuthIdentity } from "@/lib/auth-hash"
import type { GoVerifyResponse } from "@/lib/types"

const NEXTAUTH_SESSION_MAX_AGE_SECONDS = 72 * 60 * 60

function setSessionIdentity(token: Record<string, unknown>, email: string) {
  const normalizedEmail = email.toLowerCase()
  token.email = normalizedEmail
  token.aetherSub = normalizedEmail
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase()
        const password = credentials?.password
        if (!email || !password) return null

        const authHash = await hashEmailPassword(email, password)
        const verified = await goFetch<GoVerifyResponse>("/auth/verify", {
          method: "POST",
          body: JSON.stringify({ username: email, authHash }),
        })

        return {
          id: String(verified.userId),
          email: verified.username,
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy_google_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy_google_client_secret",
    }),
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "dummy_github_client_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "dummy_github_client_secret",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: NEXTAUTH_SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: NEXTAUTH_SESSION_MAX_AGE_SECONDS,
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false
      if (account?.provider === "credentials") return true

      const provider = account?.provider
      const providerAccountId = account?.providerAccountId
      if (!provider || !providerAccountId) return false

      try {
        const email = user.email.toLowerCase()
        const authHash = await hashOAuthIdentity(provider, providerAccountId)
        await goFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({ username: email, authHash }),
        }).catch(() => null)
        await goFetch<GoVerifyResponse>("/auth/verify", {
          method: "POST",
          body: JSON.stringify({ username: email, authHash }),
        })
        return true
      } catch (err) {
        console.error("OAuth signin error:", err)
        return false
      }
    },
    async jwt({ token, user }) {
      delete (token as any).goToken
      delete (token as any).goTokenExpiresAt
      delete (token as any).goTokenError
      if (user?.email) {
        setSessionIdentity(token as Record<string, unknown>, user.email)
      }
      return token
    },
    async session({ session, token }) {
      if ((token as any).aetherSub || token.sub) {
        ;(session as any).sub = (token as any).aetherSub || token.sub
      }
      return session
    },
  },
}
