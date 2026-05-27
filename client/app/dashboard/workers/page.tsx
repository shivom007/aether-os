"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pause, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WorkerCard } from "@/components/workers/worker-card"
import { JobStreamTable } from "@/components/workers/job-stream-table"
import { QueueDepthChart } from "@/components/workers/queue-depth-chart"
import { api } from "@/lib/api"
import type { AetherEvent, Job, Worker } from "@/lib/types"

interface WorkerHealthResp {
  workers: Worker[]
  paused: boolean
  recent_jobs: Job[]
}

type JobEvent = AetherEvent<{
  job_id: string
  inode_id: string
  chunk_index: number
  duration_ms?: number
  error?: string
  shards?: Array<{ shard_index: number; provider_id: string }>
}>

export default function WorkersPage() {
  const qc = useQueryClient()
  const [liveJobs, setLiveJobs] = useState<JobEvent[]>([])

  const { data } = useQuery({
    queryKey: ["workers-health"],
    queryFn: () => api<WorkerHealthResp>("/api/workers/health"),
    refetchInterval: 5_000,
  })

  useEffect(() => {
    const es = new EventSource("/api/events/stream?subjects=aether.jobs.")
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data) as JobEvent
        setLiveJobs((prev) => [e, ...prev].slice(0, 100))
      } catch {
        // ignore
      }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [])

  const pause = useMutation({
    mutationFn: (paused: boolean) =>
      api("/api/workers/pause", { method: "POST", body: JSON.stringify({ paused }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workers-health"] })
      toast.success(data?.paused ? "Resumed" : "Paused")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const retry = useMutation({
    mutationFn: () => api("/api/jobs/retry", { method: "POST", body: "{}" }),
    onSuccess: (r) => toast.success(`Re-queued ${(r as { requeued: number }).requeued} jobs`),
    onError: (e: Error) => toast.error(e.message),
  })

  const workers = data?.workers ?? []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Worker pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Live view of the chunk encode + shard upload pool. Events bridged from <code className="font-mono">aether.jobs.&gt;</code>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => retry.mutate()} disabled={retry.isPending}>
            <RefreshCw className="mr-2 size-4" aria-hidden />
            Retry failed
          </Button>
          <Button
            variant={data?.paused ? "default" : "outline"}
            onClick={() => pause.mutate(!data?.paused)}
            disabled={pause.isPending}
          >
            {data?.paused ? (
              <>
                <Play className="mr-2 size-4" aria-hidden />
                Resume pool
              </>
            ) : (
              <>
                <Pause className="mr-2 size-4" aria-hidden />
                Pause pool
              </>
            )}
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workers.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No workers registered</CardTitle>
              <CardDescription>
                Workers register themselves on the first incoming job. Upload a chunk to spin one up.
              </CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ) : (
          workers.map((w) => <WorkerCard key={w.id} worker={w} />)
        )}
      </section>

      <JobStreamTable events={liveJobs} recent={data?.recent_jobs ?? []} />

      <QueueDepthChart />
    </div>
  )
}
