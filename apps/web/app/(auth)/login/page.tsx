"use client"

export const dynamic = "force-dynamic"

import { useState, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useAuthStore } from "@/stores/auth-store"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const setUser = useAuthStore((s) => s.setUser)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    console.log("[login] form submitted, email:", email)
    setBusy(true)
    
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const nextUrl = search.get("next") ?? "/dashboard"
      const safeNextUrl = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard"

      console.log("[login] calling signIn for:", normalizedEmail)

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false,
      })

      console.log("[login] result:", result)

      if (result?.error) {
        toast.error(result.error === "CredentialsSignin" ? "Invalid email or password" : result.error)
        return
      }

      console.log("[login] success, redirecting to:", safeNextUrl)
      setUser({ sub: normalizedEmail, email: normalizedEmail, salt_b64: "" })
      toast.success("Signed in")

      // Delay slightly to ensure cookie is written
      setTimeout(() => {
        window.location.replace(safeNextUrl)
      }, 100)
    } catch (err) {
      console.error("[login] error:", err)
      toast.error((err as Error).message || "Login failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="size-8 rounded-md bg-foreground text-background grid place-items-center font-mono text-sm font-bold"
          >
            Ae
          </div>
          <span className="font-mono text-sm text-muted-foreground">aether-os</span>
        </div>
        <CardTitle className="text-2xl text-balance">Sign in to your console</CardTitle>
        <CardDescription>
          Sign in using your email or a linked provider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner className="mr-2" /> : null}
            {busy ? "Signing in" : "Sign in"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={() => signIn("google", { callbackUrl: search.get("next") ?? "/dashboard" })}>
              Google
            </Button>
            <Button type="button" variant="outline" onClick={() => signIn("github", { callbackUrl: search.get("next") ?? "/dashboard" })}>
              GitHub
            </Button>
          </div>

          <p className="mt-2 text-sm text-muted-foreground text-center">
            No account?{" "}
            <Link href="/signup" className="underline underline-offset-4 text-foreground">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
