"use client"

import { useEffect, useState } from "react"
import { Activity } from "lucide-react"
import { MetricCard } from "./metric-card"
import type { AetherEvent } from "@/lib/types"

export function ActiveUploadsMetric() {
  const [inFlight, setInFlight] = useState(0)
  const [lastSubject, setLastSubject] = useState<string | null>(null)

  useEffect(() => {
    const es = new EventSource("/api/events/stream?subjects=aether.jobs.")
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data) as AetherEvent
        setLastSubject(e.subject)
        if (e.subject === "aether.jobs.queued" || e.subject === "aether.jobs.uploading" || e.subject === "aether.jobs.encoding") {
          setInFlight((n) => n + 1)
        }
        if (e.subject === "aether.jobs.complete" || e.subject === "aether.jobs.failed") {
          setInFlight((n) => Math.max(0, n - 1))
        }
      } catch {
        // ignore
      }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [])

  return (
    <MetricCard
      label="Active uploads"
      icon={Activity}
      value={inFlight}
      accent={inFlight > 0 ? "primary" : "default"}
      hint={lastSubject ? <span className="font-mono">last: {lastSubject}</span> : "Listening to aether.jobs.>"}
      mono
    />
  )
}
