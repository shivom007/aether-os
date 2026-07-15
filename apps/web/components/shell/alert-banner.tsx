"use client"

import { AlertTriangle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

interface HealthResponse {
  status: string
  message: string
}

export function AlertBanner() {
  const q = useQuery({
    queryKey: ["system-health"],
    queryFn: async (): Promise<HealthResponse> => {
      const res = await fetch("/api/health")
      if (!res.ok) throw new Error("Health ping failed")
      return res.json()
    },
    refetchInterval: 15_000,
  })

  const shouldShow = !!q.error || (q.data && q.data.status !== "ok")
  if (!shouldShow) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-14 z-20 flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span className="font-mono text-[11px]">System Status</span>
      <span className="truncate">{q.data?.message || (q.error as Error)?.message || "Degraded system state"}</span>
    </div>
  )
}
