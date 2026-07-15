"use client"

import { useQuery } from "@tanstack/react-query"
import { HardDrive, Server, Database } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { ActiveUploadsMetric } from "@/components/dashboard/active-uploads"
import { UploadThroughputChart, EncodeLatencyChart } from "@/components/dashboard/charts"
import { fetcher } from "@/lib/api"
import { formatBytes } from "@/lib/format"
import type { Volume, Worker } from "@/lib/types"

export default function DashboardPage() {
  const volumesQ = useQuery({
    queryKey: ["volumes"],
    queryFn: () => fetcher<Volume[]>("/api/volumes"),
    refetchInterval: 30_000,
  })
  const workersQ = useQuery({
    queryKey: ["workers-health"],
    queryFn: () =>
      fetcher<{ workers: Worker[]; paused: boolean }>("/api/workers/health"),
    refetchInterval: 10_000,
  })

  const volumes = volumesQ.data ?? []
  const totalVolumes = volumes.length
  const totalBytes = volumes.reduce((s, v) => s + (v.logical_size_bytes || 0), 0)
  const workers = workersQ.data?.workers ?? []
  const online = workers.filter((w) => w.status !== "offline").length
  const busy = workers.filter((w) => w.status === "processing").length
  const poolStatus =
    workersQ.data?.paused
      ? { label: "paused", accent: "warning" as const }
      : online === 0
        ? { label: "offline", accent: "danger" as const }
        : busy > 0
          ? { label: "processing", accent: "primary" as const }
          : { label: "idle", accent: "success" as const }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Overview</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          Live state of your zero-knowledge cloud aggregator. Cards refresh independently.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total volumes"
          value={totalVolumes}
          hint={`${volumes.reduce((s, v) => s + (v.inode_count || 0), 0)} files`}
          icon={HardDrive}
          accent="primary"
          mono
        />
        <ActiveUploadsMetric />
        <MetricCard
          label="Storage used (logical)"
          value={formatBytes(totalBytes)}
          hint="Sum of inode sizes"
          icon={Database}
          accent="primary"
          mono
        />
        <MetricCard
          label="Worker pool"
          value={
            <span className="inline-flex items-center gap-2">
              <span className={`inline-block size-2 rounded-full ${dotCls(poolStatus.accent)}`} aria-hidden />
              {poolStatus.label}
            </span>
          }
          hint={`${online} online · ${busy} processing`}
          icon={Server}
          accent={poolStatus.accent}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UploadThroughputChart />
        <EncodeLatencyChart />
      </section>
    </div>
  )
}

function dotCls(accent: "default" | "primary" | "warning" | "danger" | "success") {
  switch (accent) {
    case "success":
      return "bg-emerald-500"
    case "warning":
      return "bg-amber-500"
    case "danger":
      return "bg-destructive"
    case "primary":
      return "bg-foreground"
    default:
      return "bg-muted-foreground"
  }
}
