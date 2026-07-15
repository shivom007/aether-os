/**
 * Event bus. Mirrors the NATS subject spec used in production:
 *
 *   aether.jobs.queued
 *   aether.jobs.encoding
 *   aether.jobs.uploading
 *   aether.jobs.complete
 *   aether.jobs.failed
 *   aether.workers.heartbeat
 *   aether.alerts.*
 *
 * Events are persisted in the `events` table and the SSE bridge polls
 * for new rows. A Postgres LISTEN/NOTIFY upgrade is a drop-in swap.
 */
import { sql } from "./db"

export type AetherSubject = `aether.${string}`

export async function emitEvent(subject: AetherSubject, payload: Record<string, unknown>): Promise<void> {
  await sql`
    INSERT INTO events (subject, payload)
    VALUES (${subject}, ${JSON.stringify(payload)}::jsonb)
  `
}

export async function fetchEventsSince(lastId: number, subjectPrefix = "aether."): Promise<
  Array<{ id: number; subject: string; payload: unknown; created_at: string }>
> {
  const rows = await sql`
    SELECT id, subject, payload, created_at
    FROM events
    WHERE id > ${lastId}
      AND subject LIKE ${subjectPrefix + "%"}
    ORDER BY id ASC
    LIMIT 500
  `
  return rows as Array<{ id: number; subject: string; payload: unknown; created_at: string }>
}

export async function latestEventId(): Promise<number> {
  const rows = await sql`SELECT COALESCE(MAX(id), 0)::bigint AS id FROM events`
  return Number((rows[0] as { id: number | string }).id)
}

/** Alias — mirrors NATS publish() naming. */
export const publishEvent = emitEvent
