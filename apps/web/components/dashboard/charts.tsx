"use client"

import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { fetcher } from "@/lib/api"

interface Series {
  name: string
  points: { t: string; v: number }[]
}

function useQueryProm(query: string, refetchInterval = 15_000) {
  return useQuery({
    queryKey: ["prom", query],
    queryFn: () => fetcher<{ series: Series[] }>(`/api/prometheus/query?query=${encodeURIComponent(query)}`),
    refetchInterval,
  })
}

function formatTime(s: string) {
  const d = new Date(s)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function UploadThroughputChart() {
  const q = useQueryProm("rate(aether_chunks_uploaded_total[5m])")
  const data = (q.data?.series[0]?.points || []).map((p) => ({ t: formatTime(p.t), v: Number(p.v.toFixed(3)) }))
  const config: ChartConfig = {
    v: { label: "chunks/s", color: "var(--chart-2)" },
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upload throughput</CardTitle>
        <CardDescription>
          <code className="font-mono text-xs">rate(aether_chunks_uploaded_total[5m])</code> · last 1h
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-16/7">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-v)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-v)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} className="text-[10px]" />
            <YAxis tickLine={false} axisLine={false} width={28} className="text-[10px]" />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area type="monotone" dataKey="v" stroke="var(--color-v)" strokeWidth={2} fill="url(#tp)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function EncodeLatencyChart() {
  const q = useQueryProm("histogram_quantile(0.5|0.99, aether_encode_duration_seconds_bucket)")
  const p50 = q.data?.series.find((s) => s.name.startsWith("p50"))?.points || []
  const p99 = q.data?.series.find((s) => s.name.startsWith("p99"))?.points || []
  const data = p50.map((p, i) => ({
    t: formatTime(p.t),
    p50: Number(p.v.toFixed(1)),
    p99: Number((p99[i]?.v ?? 0).toFixed(1)),
  }))
  const config: ChartConfig = {
    p50: { label: "p50 (ms)", color: "var(--chart-2)" },
    p99: { label: "p99 (ms)", color: "var(--chart-4)" },
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Erasure coding latency</CardTitle>
        <CardDescription>
          <code className="font-mono text-xs">histogram_quantile · aether_encode_duration_seconds_bucket</code>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-16/7">
          <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} className="text-[10px]" />
            <YAxis tickLine={false} axisLine={false} width={32} className="text-[10px]" />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Line dataKey="p50" stroke="var(--color-p50)" strokeWidth={2} dot={false} type="monotone" />
            <Line dataKey="p99" stroke="var(--color-p99)" strokeWidth={2} dot={false} type="monotone" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
