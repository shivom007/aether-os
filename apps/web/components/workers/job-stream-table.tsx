"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AetherEvent, Job } from "@/lib/types"

type JobEvent = AetherEvent<{
  job_id: string
  inode_id: string
  chunk_index: number
  duration_ms?: number
  error?: string
  shards?: Array<{ shard_index: number; provider_id: string }>
}>

interface Row {
  job_id: string
  inode_id: string
  chunk_index: number
  status: string
  subject: string
  ts: string
  duration_ms?: number
  error?: string
  shards?: Array<{ shard_index: number; provider_id: string }>
}

export function JobStreamTable({
  events,
  recent,
}: {
  events: JobEvent[]
  recent: Job[]
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const rows: Row[] = useMemo(() => {
    const byJob = new Map<string, Row>()
    // seed with recent DB jobs so the table is never empty
    for (const j of recent) {
      byJob.set(j.id, {
        job_id: j.id,
        inode_id: j.inode_id,
        chunk_index: j.chunk_index,
        status: j.status,
        subject: `aether.jobs.${j.status}`,
        ts: j.updated_at,
        error: j.last_error || undefined,
      })
    }
    // overlay live SSE events (newer wins)
    for (const e of events) {
      const statusFromSubject = e.subject.replace("aether.jobs.", "")
      const prev = byJob.get(e.payload.job_id)
      byJob.set(e.payload.job_id, {
        job_id: e.payload.job_id,
        inode_id: e.payload.inode_id,
        chunk_index: e.payload.chunk_index,
        status: statusFromSubject,
        subject: e.subject,
        ts: e.created_at,
        duration_ms: e.payload.duration_ms ?? prev?.duration_ms,
        error: e.payload.error ?? prev?.error,
        shards: e.payload.shards ?? prev?.shards,
      })
    }
    return Array.from(byJob.values())
      .sort((a, b) => (a.ts < b.ts ? 1 : -1))
      .slice(0, 100)
  }, [events, recent])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Live job stream</CardTitle>
        <CardDescription>
          Last 100 chunk jobs. Click a row to see shard destinations.
        </CardDescription>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-4" />
              <TableHead>Timestamp</TableHead>
              <TableHead>Inode</TableHead>
              <TableHead>Chunk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isOpen = expanded.has(r.job_id)
              return (
                <Fragment key={r.job_id}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(r.job_id)}>
                    <TableCell>
                      {isOpen ? (
                        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">
                      {new Date(r.ts).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-mono text-[11px]">{r.inode_id.slice(0, 8)}…</TableCell>
                    <TableCell className="tabular-nums text-xs">{r.chunk_index}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">{r.subject}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {r.duration_ms ? `${r.duration_ms}ms` : "—"}
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="flex flex-col gap-1 p-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Job ID: </span>
                            <span className="font-mono">{r.job_id}</span>
                          </div>
                          {r.error && (
                            <div className="text-destructive">
                              <span className="text-muted-foreground">Error: </span>
                              {r.error}
                            </div>
                          )}
                          {r.shards && r.shards.length > 0 && (
                            <div>
                              <span className="text-muted-foreground">Shards: </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {r.shards.map((s) => (
                                  <span
                                    key={s.shard_index}
                                    className="rounded border border-border bg-background px-1.5 py-0.5 font-mono"
                                  >
                                    {s.shard_index}: {s.provider_id.slice(0, 8)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Waiting for jobs…
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    queued: "bg-muted text-foreground",
    encoding: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    uploading: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    complete: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    failed: "bg-destructive/10 text-destructive",
  }
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${cls[status] ?? "bg-muted"}`}>
      {status}
    </span>
  )
}
