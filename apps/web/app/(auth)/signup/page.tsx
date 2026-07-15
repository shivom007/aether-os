"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useAuthStore } from "@/stores/auth-store"
import { json } from "@/lib/api"
import { signIn } from "next-auth/react"

export default function SignupPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const { user } = await json<{ user: { sub: string; email: string; salt_b64: string } }>(res)
      const result = await signIn("credentials", {
        email: user.email,
        password,
        redirect: false,
      })

      if (!result?.ok) {
        throw new Error(
          result?.error === "CredentialsSignin"
            ? "Account created, but sign-in failed"
            : result?.error || "Account created, but sign-in failed",
        )
      }

      setUser(user)
      toast.success("Account created")
      router.replace("/dashboard")
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message || "Sign up failed")
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
        <CardTitle className="text-2xl text-balance">Create your console</CardTitle>
        <CardDescription>
          Sign up using your email or a linked provider.
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 8 characters. If you lose it, encrypted data is unrecoverable.
            </p>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner className="mr-2" /> : null}
            {busy ? "Creating" : "Create account"}
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
            <Button type="button" variant="outline" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
              Google
            </Button>
            <Button type="button" variant="outline" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
              GitHub
            </Button>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Already have one?{" "}
            <Link href="/login" className="underline underline-offset-4 text-foreground">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
