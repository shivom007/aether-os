"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Cpu, MemoryStick } from "lucide-react"
import type { Worker } from "@/lib/types"
import { relativeTime } from "@/lib/format"

const statusColor: Record<Worker["status"], string> = {
  idle: "bg-emerald-500",
  processing: "bg-sky-500",
  error: "bg-destructive",
  offline: "bg-muted-foreground",
}

export function WorkerCard({ worker }: { worker: Worker }) {
  const pulse = worker.status === "processing" ? "motion-safe:animate-pulse" : ""
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="font-mono text-sm truncate">{worker.node_id}</CardTitle>
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`inline-block size-2 rounded-full ${statusColor[worker.status]} ${pulse}`}
          />
          <span className="text-xs text-muted-foreground">{worker.status}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Jobs processed</dt>
            <dd className="font-mono text-sm tabular-nums">{worker.jobs_processed.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Uptime</dt>
            <dd className="text-sm">{relativeTime(worker.started_at)}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Cpu className="size-3" aria-hidden />
                CPU
              </span>
              <span className="font-mono tabular-nums">{worker.cpu_percent.toFixed(0)}%</span>
            </div>
            <Progress value={worker.cpu_percent} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MemoryStick className="size-3" aria-hidden />
                Memory
              </span>
              <span className="font-mono tabular-nums">{worker.memory_percent.toFixed(0)}%</span>
            </div>
            <Progress value={worker.memory_percent} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
