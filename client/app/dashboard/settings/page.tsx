"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { api } from "@/lib/api"
import { useAuthStore } from "@/stores/auth-store"
import type { Volume } from "@/lib/types"
import { formatBytes } from "@/lib/format"
import { Shield } from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const reset = useAuthStore((s) => s.reset)

  const { data: volumes } = useQuery({
    queryKey: ["volumes"],
    queryFn: () => api<Volume[]>("/api/volumes"),
  })

  const totalBytes = (volumes ?? []).reduce((s, v) => s + (v.logical_size_bytes || 0), 0)

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    reset()
    toast.success("Signed out")
    router.replace("/login")
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Account, keys, and quotas.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Signed-in identity and tokens.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-mono text-xs">{user?.email ?? "—"}</dd>
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="font-mono text-xs">{user?.sub ?? "—"}</dd>
            <dt className="text-muted-foreground">Salt (b64)</dt>
            <dd className="font-mono text-[11px] text-muted-foreground truncate">{user?.salt_b64 ?? "—"}</dd>
          </dl>
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" onClick={logout}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zero-knowledge keys</CardTitle>
          <CardDescription>
            Master keys live only in this browser tab after you enter your passphrase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="size-4" aria-hidden />
            <AlertTitle>Your passphrase is the recovery.</AlertTitle>
            <AlertDescription>
              Aether-OS stores only a PBKDF2 salt and a SHA-256 fingerprint of your key. Lose the
              passphrase and encrypted data is unrecoverable.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage</CardTitle>
          <CardDescription>Logical size used across all volumes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="text-3xl font-semibold tabular-nums">{formatBytes(totalBytes)}</p>
          <p className="text-xs text-muted-foreground">
            {volumes?.length ?? 0} volumes ·{" "}
            {(volumes ?? []).reduce((s, v) => s + (v.inode_count || 0), 0)} files
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
