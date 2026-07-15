"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowUpDown, FolderOpen, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { formatBytes, relativeTime } from "@/lib/format"
import type { Volume } from "@/lib/types"

type SortKey = "name" | "created_at" | "logical_size_bytes"

export function VolumesTable({
  volumes,
  isLoading,
  onSelect,
}: {
  volumes: Volume[]
  isLoading: boolean
  onSelect: (v: Volume) => void
  baseHref?: string
}) {
  const { baseHref = "/dashboard/volumes" } = arguments[0]
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const qc = useQueryClient()

  const del = useMutation({
    mutationFn: (id: string) => api(`/api/volumes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Volume deleted")
      qc.invalidateQueries({ queryKey: ["volumes"] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = useMemo(() => {
    const filtered = volumes.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
    return [...filtered].sort((a, b) => {
      let av: string | number = ""
      let bv: string | number = ""
      if (sortKey === "name") {
        av = a.name
        bv = b.name
      } else if (sortKey === "created_at") {
        av = new Date(a.created_at).getTime()
        bv = new Date(b.created_at).getTime()
      } else {
        av = a.logical_size_bytes
        bv = b.logical_size_bytes
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [volumes, query, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Filter volumes by name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
        aria-label="Filter volumes"
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => toggleSort("name")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Name <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort("created_at")}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  Created <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => toggleSort("logical_size_bytes")}
                  className="ml-auto flex items-center gap-1 hover:text-foreground"
                >
                  Logical size <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </TableHead>
              <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <Empty className="border-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FolderOpen />
                      </EmptyMedia>
                      <EmptyTitle>No volumes yet</EmptyTitle>
                      <EmptyDescription>
                        Create your first volume to start uploading encrypted files.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => onSelect(v)}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {v.owner_id.slice(0, 8)}…
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {relativeTime(v.created_at)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(v.logical_size_bytes)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`${baseHref}/${v.id}/browse`}>
                          <FolderOpen className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Browse {v.name}</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onSelect(v)}>
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Upload to {v.name}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${v.name}? This cannot be undone.`)) del.mutate(v.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                        <span className="sr-only">Delete {v.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
