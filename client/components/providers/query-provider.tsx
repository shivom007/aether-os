"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 10_000,
            retry: (failureCount, err: unknown) => {
              const e = err as { status?: number }
              if (e?.status === 401) return false
              return failureCount < 2
            },
          },
        },
      }),
  )

  // Global 401 interceptor: if any query returns 401, bounce to /login.
  useEffect(() => {
    const unsub = client.getQueryCache().subscribe((ev) => {
      if (ev.type === "updated" && ev.query.state.status === "error") {
        const e = ev.query.state.error as { status?: number } | null
        if (e?.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          router.replace("/login")
        }
      }
    })
    return () => unsub()
  }, [client, router])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
