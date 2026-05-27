"use client"

import { useEffect, useState } from "react"
import { ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { UploadThroughputChart, EncodeLatencyChart } from "@/components/dashboard/charts"
import { QueueDepthChart } from "@/components/workers/queue-depth-chart"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState("# loading…")

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch("/metrics")
        const text = await res.text()
        if (!cancelled) setMetrics(text)
      } catch {
        // ignore
      }
    }
    tick()
    const id = setInterval(tick, 10_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Observability</h1>
        <p className="text-sm text-muted-foreground">
          In-app Prometheus exposition, Postgres LISTEN/NOTIFY bridge metrics, and external consoles.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UploadThroughputChart />
        <EncodeLatencyChart />
        <QueueDepthChart />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">External consoles</CardTitle>
            <CardDescription>
              Deep links to component admin UIs. Replace with real deployment URLs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-between bg-transparent">
              <a href="http://localhost:8080" target="_blank" rel="noreferrer">
                CockroachDB Console
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-between bg-transparent">
              <a href="http://localhost:8222" target="_blank" rel="noreferrer">
                NATS Monitor
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-between bg-transparent">
              <a href="/metrics" target="_blank" rel="noreferrer">
                Raw /metrics (Prometheus text)
                <ExternalLink className="size-4" aria-hidden />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prometheus exposition</CardTitle>
          <CardDescription>
            Live output of <code className="font-mono">/metrics</code>. Refreshes every 10s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px] rounded-md border bg-muted/30">
            <pre className="p-4 font-mono text-[11px] leading-relaxed">{metrics}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
