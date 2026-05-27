import { NextResponse } from "next/server"
import type { ApiResult } from "./types"

/** Server helpers */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResult<T>>({ success: true, data }, init)
}

export function fail(error: string, status = 400) {
  return NextResponse.json<ApiResult<never>>({ success: false, error }, { status })
}

/** Unwrap a Response into its data payload or throw. */
export async function json<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiResult<T>
  if (!body.success) throw new Error(body.error)
  return body.data
}

/** SWR/Query compatible fetcher — convenience alias for GET requests. */
export async function fetcher<T>(url: string): Promise<T> {
  return api<T>(url)
}

/** Client helper. Fetches, unwraps the `{success, data}` envelope and throws on error. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(hasBody && !(init!.body instanceof ArrayBuffer) && !(init!.body instanceof Uint8Array)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    throw Object.assign(new Error("unauthorized"), { status: 401 })
  }
  return json<T>(res)
}
