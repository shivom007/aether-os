/**
 * Minimal in-process Prometheus-compatible metrics registry.
 *
 * Exposes a /metrics endpoint in Prom text format and a
 * /api/prometheus/query endpoint that answers instant + range queries
 * for the specific series the dashboard needs.
 *
 * Since a serverless Next.js app may be spun up across multiple
 * invocations, counters are persisted in the `events` table as
 * side-effects of the domain events they emit — this means charts
 * remain accurate across cold starts.
 */
import { sql } from "./db"

// -------- text-format exposition --------
export async function renderPromText(): Promise<string> {
  const lines: string[] = []

  // aether_chunks_uploaded_total
  const uploaded = (await sql`
    SELECT COUNT(*)::bigint AS c
    FROM events
    WHERE subject = 'aether.jobs.complete'
  `) as Array<{ c: number | string }>
  lines.push(`# HELP aether_chunks_uploaded_total Total chunks successfully uploaded.`)
  lines.push(`# TYPE aether_chunks_uploaded_total counter`)
  lines.push(`aether_chunks_uploaded_total ${Number(uploaded[0]?.c ?? 0)}`)

  // aether_chunks_failed_total
  const failed = (await sql`
    SELECT COUNT(*)::bigint AS c
    FROM events
    WHERE subject = 'aether.jobs.failed'
  `) as Array<{ c: number | string }>
  lines.push(`# HELP aether_chunks_failed_total Total chunk jobs failed.`)
  lines.push(`# TYPE aether_chunks_failed_total counter`)
  lines.push(`aether_chunks_failed_total ${Number(failed[0]?.c ?? 0)}`)

  // aether_queue_depth
  const qDepth = (await sql`
    SELECT COUNT(*)::bigint AS c FROM jobs WHERE status IN ('queued','encoding','uploading')
  `) as Array<{ c: number | string }>
  lines.push(`# HELP aether_queue_depth Current number of in-flight jobs.`)
  lines.push(`# TYPE aether_queue_depth gauge`)
  lines.push(`aether_queue_depth ${Number(qDepth[0]?.c ?? 0)}`)

  // nats_consumer_pending_count (alias)
  lines.push(`# HELP nats_consumer_pending_count Pending jobs (alias of aether_queue_depth).`)
  lines.push(`# TYPE nats_consumer_pending_count gauge`)
  lines.push(`nats_consumer_pending_count ${Number(qDepth[0]?.c ?? 0)}`)

  // aether_encode_duration_seconds_bucket (derived from completion events' duration_ms payload)
  const buckets = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]
  const rows = (await sql`
    SELECT (payload->>'duration_ms')::float AS ms
    FROM events
    WHERE subject = 'aether.jobs.complete'
      AND payload ? 'duration_ms'
  `) as Array<{ ms: number }>
  const durations = rows.map((r) => r.ms / 1000)
  lines.push(`# HELP aether_encode_duration_seconds Encode+upload latency per chunk.`)
  lines.push(`# TYPE aether_encode_duration_seconds histogram`)
  let cum = 0
  for (const b of buckets) {
    cum = durations.filter((d) => d <= b).length
    lines.push(`aether_encode_duration_seconds_bucket{le="${b}"} ${cum}`)
  }
  lines.push(`aether_encode_duration_seconds_bucket{le="+Inf"} ${durations.length}`)
  lines.push(`aether_encode_duration_seconds_sum ${durations.reduce((a, b) => a + b, 0).toFixed(4)}`)
  lines.push(`aether_encode_duration_seconds_count ${durations.length}`)

  // aether_workers_online
  const wOnline = (await sql`
    SELECT COUNT(*)::bigint AS c FROM workers
    WHERE last_heartbeat > now() - INTERVAL '30 seconds'
  `) as Array<{ c: number | string }>
  lines.push(`# HELP aether_workers_online Workers considered online (heartbeat < 30s).`)
  lines.push(`# TYPE aether_workers_online gauge`)
  lines.push(`aether_workers_online ${Number(wOnline[0]?.c ?? 0)}`)

  return lines.join("\n") + "\n"
}

// -------- dashboard query helpers --------
export interface RangePoint {
  t: string // ISO timestamp
  v: number
}

/** Upload throughput: chunks/sec averaged over 5 min, sampled every 1 min for the last 1h. */
export async function uploadThroughput1h(): Promise<RangePoint[]> {
  const rows = (await sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('minute', now()) - INTERVAL '59 minutes',
        date_trunc('minute', now()),
        INTERVAL '1 minute'
      ) AS bucket
    )
    SELECT
      b.bucket AS t,
      (
        SELECT COUNT(*)::float / 300.0
        FROM events e
        WHERE e.subject = 'aether.jobs.complete'
          AND e.created_at >= b.bucket - INTERVAL '5 minutes'
          AND e.created_at <  b.bucket
      ) AS v
    FROM buckets b
    ORDER BY t
  `) as Array<{ t: string; v: number }>
  return rows.map((r) => ({ t: new Date(r.t).toISOString(), v: Number(r.v) || 0 }))
}

/** p50/p99 encode latency sampled every minute for 1h. */
export async function encodeLatency1h(): Promise<{ p50: RangePoint[]; p99: RangePoint[] }> {
  const rows = (await sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('minute', now()) - INTERVAL '59 minutes',
        date_trunc('minute', now()),
        INTERVAL '1 minute'
      ) AS bucket
    )
    SELECT
      b.bucket AS t,
      COALESCE((
        SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (e.payload->>'duration_ms')::float)
        FROM events e
        WHERE e.subject = 'aether.jobs.complete'
          AND e.payload ? 'duration_ms'
          AND e.created_at >= b.bucket - INTERVAL '5 minutes'
          AND e.created_at <  b.bucket
      ), 0) AS p50,
      COALESCE((
        SELECT percentile_cont(0.99) WITHIN GROUP (ORDER BY (e.payload->>'duration_ms')::float)
        FROM events e
        WHERE e.subject = 'aether.jobs.complete'
          AND e.payload ? 'duration_ms'
          AND e.created_at >= b.bucket - INTERVAL '5 minutes'
          AND e.created_at <  b.bucket
      ), 0) AS p99
    FROM buckets b
    ORDER BY t
  `) as Array<{ t: string; p50: number; p99: number }>
  return {
    p50: rows.map((r) => ({ t: new Date(r.t).toISOString(), v: Number(r.p50) || 0 })),
    p99: rows.map((r) => ({ t: new Date(r.t).toISOString(), v: Number(r.p99) || 0 })),
  }
}

/** Queue depth over the last 15 minutes (per-minute snapshots, from event log side-effects). */
export async function queueDepth15m(): Promise<RangePoint[]> {
  const rows = (await sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('minute', now()) - INTERVAL '14 minutes',
        date_trunc('minute', now()),
        INTERVAL '1 minute'
      ) AS bucket
    )
    SELECT
      b.bucket AS t,
      -- approximate depth = queued events minus completed/failed events up to that minute
      GREATEST(
        (SELECT COUNT(*) FROM events
          WHERE subject = 'aether.jobs.queued' AND created_at <= b.bucket)
        -
        (SELECT COUNT(*) FROM events
          WHERE subject IN ('aether.jobs.complete','aether.jobs.failed') AND created_at <= b.bucket),
        0
      )::int AS v
    FROM buckets b
    ORDER BY t
  `) as Array<{ t: string; v: number }>
  return rows.map((r) => ({ t: new Date(r.t).toISOString(), v: Number(r.v) || 0 }))
}
