"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { Bell, LogOut, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Breadcrumbs } from "@/components/shell/breadcrumbs"
import { useAuthStore } from "@/stores/auth-store"
import { fetcher } from "@/lib/api"
import type { AetherEvent, Volume } from "@/lib/types"
import { useEffect, useRef, useState } from "react"

export function Topbar() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const reset = useAuthStore((s) => s.reset)
  const [q, setQ] = useState("")
  const [alerts, setAlerts] = useState<AetherEvent[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Global search over volumes
  const volumesQ = useQuery({
    queryKey: ["volumes-search", q],
    queryFn: () => fetcher<Volume[]>("/api/volumes"),
    enabled: q.length > 0,
  })

  // Live alerts via SSE
  useEffect(() => {
    const es = new EventSource("/api/events/stream?subjects=aether.alerts.")
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data) as AetherEvent
        setAlerts((prev) => [e, ...prev].slice(0, 20))
      } catch {
        // ignore
      }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [])

  // ⌘K focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    await signOut({ redirect: false })
    reset()
    toast.success("Signed out")
    router.replace("/login")
    router.refresh()
  }

  const filtered = (volumesQ.data || []).filter((v) => v.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)

  const initials =
    user?.email
      ?.split("@")[0]
      .split(/[._-]/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AE"

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 backdrop-blur px-3">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <div className="relative hidden md:block w-80">
              <InputGroup>
                <InputGroupAddon>
                  <Search className="size-4 text-muted-foreground" aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search volumes by name"
                  aria-label="Search volumes"
                />
                <InputGroupAddon align="inline-end">
                  <Kbd className="text-[10px]">⌘K</Kbd>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </PopoverTrigger>
          {q.length > 0 ? (
            <PopoverContent className="w-80 p-1" align="end">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No volumes match.</div>
              ) : (
                <ul className="flex flex-col">
                  {filtered.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/dashboard/volumes/${v.id}/browse`}
                        className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => setQ("")}
                      >
                        <span className="font-medium">{v.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{v.id.slice(0, 8)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          ) : null}
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Notifications (${alerts.length})`} className="relative">
              <Bell className="size-4" />
              {alerts.length > 0 ? (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
                >
                  {alerts.length}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Alerts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {alerts.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">No active alerts.</div>
            ) : (
              alerts.slice(0, 8).map((a) => (
                <DropdownMenuItem key={a.id} className="flex flex-col items-start gap-0.5">
                  <span className="font-mono text-[11px] text-muted-foreground">{a.subject}</span>
                  <span className="text-sm">{String((a.payload as { message?: string })?.message || "Alert")}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="User menu">
              <Avatar className="size-7">
                <AvatarFallback className="text-[11px] font-mono">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm">Signed in</span>
              <span className="font-mono text-[11px] text-muted-foreground truncate">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="size-4" aria-hidden /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
