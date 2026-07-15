"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { fetcher } from "@/lib/api"
import type { Volume } from "@/lib/types"

interface Crumb {
  label: string
  href?: string
  mono?: boolean
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const search = useSearchParams()
  const segments = pathname.split("/").filter(Boolean)

  // Look up volume name if we're inside /volumes/[id]/... or /volumes-testing/[id]/...
  const isTesting = segments.includes("volumes-testing")
  const volumeIdx = isTesting ? segments.indexOf("volumes-testing") : segments.indexOf("volumes")
  const volumeId = volumeIdx >= 0 && segments.length > volumeIdx + 1 ? segments[volumeIdx + 1] : undefined
  const volumeQ = useQuery({
    queryKey: ["volume", volumeId],
    queryFn: () => fetcher<Volume>(`/api/volumes/${volumeId}`),
    enabled: !!volumeId,
    staleTime: 60_000,
  })

  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }]

  if (segments.length === 0) {
    crumbs.push({ label: "Dashboard" })
  } else if (segments.includes("volumes") || segments.includes("volumes-testing")) {
    const basePath = isTesting ? "/dashboard/volumes-testing" : "/dashboard/volumes"
    crumbs.push({ label: isTesting ? "Volumes (Testing)" : "Volumes", href: basePath })
    if (volumeId) {
      crumbs.push({
        label: volumeQ.data?.name || volumeId.slice(0, 8),
        href: `${basePath}/${volumeId}/browse`,
        mono: !volumeQ.data,
      })
      if (segments.includes("browse")) {
        const path = (search.get("path") || "/").replace(/^\//, "")
        if (path) {
          const parts = path.split("/").filter(Boolean)
          let acc = ""
          parts.forEach((p, i) => {
            acc += "/" + p
            crumbs.push({
              label: p,
              href: i === parts.length - 1 ? undefined : `${basePath}/${volumeId}/browse?path=${encodeURIComponent(acc)}`,
            })
          })
        }
      }
    }
  } else {
    crumbs.push({ label: capital(segments[0]) })
    if (segments[1]) crumbs.push({ label: segments[1], mono: true })
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 ? <ChevronRight aria-hidden className="size-3.5 text-muted-foreground shrink-0" /> : null}
            {c.href && i < crumbs.length - 1 ? (
              <Link
                href={c.href}
                className={
                  "truncate text-muted-foreground hover:text-foreground transition-colors " +
                  (c.mono ? "font-mono text-xs" : "")
                }
              >
                {c.label}
              </Link>
            ) : (
              <span className={"truncate font-medium " + (c.mono ? "font-mono text-xs" : "")}>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function capital(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
