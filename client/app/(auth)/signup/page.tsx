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
import { derive_master_key, fromB64 } from "@/lib/crypto/core"
import { json } from "@/lib/api"

export default function SignupPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const setMasterKey = useAuthStore((s) => s.setMasterKey)
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
      const { masterKey: mk } = await derive_master_key(password, fromB64(user.salt_b64))
      setUser(user)
      setMasterKey(mk)
      toast.success("Account created")
      router.replace("/dashboard")
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
          Your password derives a zero-knowledge master key on this device. We never see it.
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
