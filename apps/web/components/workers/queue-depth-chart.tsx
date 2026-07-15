"use client"

import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { fetcher } from "@/lib/api"

interface Series {
  name: string
  points: { t: string; v: number }[]
}

export function QueueDepthChart() {
  const q = useQuery({
    queryKey: ["prom", "queue_depth"],
    queryFn: () => fetcher<{ series: Series[] }>("/api/prometheus/query?query=nats_consumer_pending_count"),
    refetchInterval: 10_000,
  })

  const data = (q.data?.series[0]?.points || []).map((p) => ({
    t: new Date(p.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    v: p.v,
  }))

  const config: ChartConfig = {
    v: { label: "pending", color: "var(--chart-1)" },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Queue depth</CardTitle>
        <CardDescription>
          In-flight jobs (queued + encoding + uploading), last 15 min
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-[16/5]">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="qd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-v)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-v)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} className="text-[10px]" />
            <YAxis tickLine={false} axisLine={false} width={28} className="text-[10px]" />
            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
            <Area dataKey="v" stroke="var(--color-v)" strokeWidth={2} fill="url(#qd)" type="monotone" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
