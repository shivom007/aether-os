/**
 * Database layer stub.
 *
 * The original dashboard used @neondatabase/serverless (Neon Postgres).
 * Since all data now comes from the Go backend, this module exports a
 * no-op placeholder so any leftover imports don't crash at startup.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql = (..._args: any[]): Promise<any[]> => {
  console.warn("lib/db.ts: sql() called but database is not configured — data comes from Go backend")
  return Promise.resolve([])
}
