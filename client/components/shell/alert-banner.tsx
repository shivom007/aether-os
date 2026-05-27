"use client"

import { AlertTriangle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetcher } from "@/lib/api"

interface HealthResponse {
  db_ok: boolean
  queue_depth: number
  worker_pool_paused: boolean
  subject: string
  message?: string
}

export function AlertBanner() {
  const q = useQuery({
    queryKey: ["system-health"],
    queryFn: () => fetcher<HealthResponse>("/api/health"),
    refetchInterval: 5_000,
  })

  const shouldShow = !!q.data && (!q.data.db_ok || q.data.queue_depth > 1000)
  if (!shouldShow) return null
  const d = q.data

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-14 z-20 flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span className="font-mono text-[11px]">{d.subject}</span>
      <span className="truncate">{d.message || "Degraded system state"}</span>
      <span className="ml-auto font-mono text-[11px]">queue_depth={d.queue_depth}</span>
    </div>
  )
}
