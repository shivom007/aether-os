"use client"

const PROVIDER_COLORS: Record<string, string> = {
  s3: "bg-chart-1",
  gcs: "bg-chart-2",
  b2: "bg-chart-3",
  azure: "bg-chart-4",
}

export function ChunkMap({
  shards,
}: {
  shards: Array<{ index: number; provider_type: string; parity: boolean }>
}) {
  if (shards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No chunks yet. Upload a file to see shard distribution.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-2">
        {shards.map((s) => (
          <div
            key={s.index}
            className={`flex aspect-square flex-col items-center justify-center rounded-md border text-xs font-medium text-white ${
              PROVIDER_COLORS[s.provider_type] ?? "bg-muted"
            } ${s.parity ? "ring-2 ring-offset-2 ring-offset-background ring-border" : ""}`}
            title={`${s.parity ? "Parity" : "Data"} shard ${s.index} on ${s.provider_type.toUpperCase()}`}
          >
            <span>{s.index}</span>
            <span className="text-[10px] uppercase opacity-80">
              {s.parity ? "parity" : "data"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(PROVIDER_COLORS).map(([k, c]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${c}`} aria-hidden="true" />
            {k.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  )
}
