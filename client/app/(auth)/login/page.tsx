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
import { derive_master_key, fromB64 } from "@/lib/crypto/core"
import { json } from "@/lib/api"

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
  const setMasterKey = useAuthStore((s) => s.setMasterKey)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const { user } = await json<{ user: { sub: string; email: string; salt_b64: string } }>(res)
      // Derive master key client-side (never sent to server)
      const { masterKey: mk } = await derive_master_key(password, fromB64(user.salt_b64))
      setUser(user)
      setMasterKey(mk)
      toast.success("Signed in")
      const nextUrl = search.get("next") ?? "/dashboard"
      const safeNextUrl = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard"
      router.replace(safeNextUrl)
    } catch (err) {
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
          Your master key is derived locally from your password and never leaves this browser.
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
          <p className="text-sm text-muted-foreground text-center">
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
