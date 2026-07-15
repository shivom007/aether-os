"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Cloud } from "lucide-react"
import { api } from "@/lib/api"
import { relativeTime } from "@/lib/format"
import type { ProviderCredential, ProviderLatencyResult } from "@/lib/types"
import { AddProviderDialog } from "@/components/providers/add-provider-dialog"

export default function ProvidersPage() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: () => api<ProviderCredential[]>("/api/providers"),
    refetchInterval: 30_000,
  })

  // Update the query type
  const { data: latencies } = useQuery({
    queryKey: ["provider-latencies"],
    queryFn: () => api<Record<string, ProviderLatencyResult>>("/api/providers/latency"),
    refetchInterval: 15_000,
  })

  const check = useMutation({
    mutationFn: (id: string) => api(`/api/providers/${id}/health`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] })
      toast.success("Health re-checked")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const del = useMutation({
    mutationFn: (id: string) => api(`/api/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] })
      toast.success("Provider removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
          <p className="text-sm text-muted-foreground">
            Object-storage backends receiving erasure-coded shards. Access tokens are encrypted at rest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => (window.location.href = "/api/providers/oauth?provider=google")}>
            <Cloud className="mr-2 h-4 w-4" aria-hidden />
            Google Drive
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/api/providers/oauth?provider=dropbox")}>
            <Cloud className="mr-2 h-4 w-4" aria-hidden />
            Dropbox
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add provider
          </Button>
        </div>
      </header>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Endpoint / Bucket</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Added</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Cloud />
                      </EmptyMedia>
                      <EmptyTitle>No providers connected</EmptyTitle>
                      <EmptyDescription>
                        Add at least one S3-compatible bucket so the worker pool can place shards.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const latencyResult = latencies?.[p.id]
                const latencyMs = latencyResult?.latencyMs
                const latencyStatus = latencyResult?.status
                const effectiveStatus = latencyStatus === "unhealthy" ? "unhealthy" : p.status
                const latencyColor = latencyMs !== undefined
                  ? latencyMs < 200 ? "text-emerald-500"
                    : latencyMs < 600 ? "text-yellow-500"
                      : "text-destructive"
                  : ""

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono uppercase text-xs">{p.provider_type}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs whitespace-nowrap">
                        {p.endpoint_url ? `${p.endpoint_url} / ` : ""}
                        {p.bucket}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{p.region || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{relativeTime(p.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${effectiveStatus === "healthy"
                              ? "text-emerald-500"
                              : effectiveStatus === "unhealthy"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                        >
                          <span
                            aria-hidden
                            className={`size-2 rounded-full ${effectiveStatus === "healthy"
                                ? "bg-emerald-500"
                                : effectiveStatus === "unhealthy"
                                  ? "bg-destructive"
                                  : "bg-muted-foreground"
                              }`}
                          />
                          {effectiveStatus}
                        </span>
                        {latencyMs !== undefined && (
                          <span className={`text-[10px] font-mono ${latencyColor}`}>
                            {latencyMs}ms · {latencyStatus}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={check.isPending}
                          onClick={() => check.mutate(p.id)}
                          aria-label="Re-check health"
                        >
                          <RefreshCw className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remove provider ${p.bucket}?`)) del.mutate(p.id)
                          }}
                          aria-label="Remove provider"
                        >
                          <Trash2 className="size-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AddProviderDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
