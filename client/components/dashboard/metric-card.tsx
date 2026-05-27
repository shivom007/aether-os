import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: LucideIcon
  accent?: "default" | "primary" | "warning" | "danger" | "success"
  mono?: boolean
}

const accentMap: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  default: "text-muted-foreground",
  primary: "text-foreground",
  warning: "text-amber-500",
  danger: "text-destructive",
  success: "text-emerald-500",
}

export function MetricCard({ label, value, hint, icon: Icon, accent = "default", mono }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={cn("size-4", accentMap[accent])} aria-hidden />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tracking-tight tabular-nums", mono && "font-mono")}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  )
}
