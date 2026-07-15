"use client"

import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileIcon } from "lucide-react"
import { useState } from "react"
import { api } from "@/lib/api"
import type { Inode } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"

export function FileTree({
  volumeId,
  selectedId,
  onSelect,
}: {
  volumeId: string
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <nav
      aria-label="File tree"
      role="tree"
      className="rounded-lg border bg-card p-2 text-sm max-h-[60vh] overflow-y-auto"
    >
      <RootRow volumeId={volumeId} selectedId={selectedId} onSelect={onSelect} />
    </nav>
  )
}

function RootRow({
  volumeId,
  selectedId,
  onSelect,
}: {
  volumeId: string
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["inodes-root", volumeId],
    queryFn: () =>
      api<{ inodes: Inode[]; root_id: string | null }>(`/api/inodes/volume/${volumeId}`),
  })

  const active = selectedId === null
  return (
    <div role="group">
      <button
        role="treeitem"
        aria-selected={active}
        onClick={() => onSelect(null)}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-accent ${
          active ? "bg-accent font-medium" : ""
        }`}
      >
        <FolderOpen className="size-4 text-muted-foreground" aria-hidden />
        <span>/</span>
      </button>
      {isLoading ? (
        <div className="pl-4 pt-1">
          <Skeleton className="h-5 w-full" />
        </div>
      ) : (
        <ul role="group" className="pl-4">
          {data?.inodes
            .filter((n) => n.kind === "dir")
            .map((dir) => (
              <TreeNode
                key={dir.id}
                volumeId={volumeId}
                inode={dir}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={1}
              />
            ))}
        </ul>
      )}
    </div>
  )
}

function TreeNode({
  volumeId,
  inode,
  selectedId,
  onSelect,
  depth,
}: {
  volumeId: string
  inode: Inode
  selectedId: string | null
  onSelect: (id: string | null) => void
  depth: number
}) {
  const [open, setOpen] = useState(false)
  const active = selectedId === inode.id
  const isFile = inode.kind === "file"
  const { data } = useQuery({
    queryKey: ["inodes-children", inode.id],
    queryFn: () =>
      api<{ inodes: Inode[]; root_id: string | null }>(
        `/api/inodes/volume/${volumeId}?parent_id=${inode.id}`,
      ),
    enabled: open && !isFile,
  })

  return (
    <li role="treeitem" aria-expanded={!isFile ? open : undefined} aria-selected={active}>
      <button
        onClick={() => {
          if (!isFile) setOpen((o) => !o)
          onSelect(inode.id)
        }}
        className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-left hover:bg-accent ${
          active ? "bg-accent font-medium" : ""
        }`}
        style={{ paddingLeft: `${depth * 8 + 4}px` }}
      >
        {!isFile ? (
          open ? (
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
          )
        ) : (
          <span className="inline-block size-3.5" aria-hidden />
        )}
        {isFile ? (
          <FileIcon className="size-4 text-muted-foreground" aria-hidden />
        ) : open ? (
          <FolderOpen className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <Folder className="size-4 text-muted-foreground" aria-hidden />
        )}
        <span className="truncate">{inode.name}</span>
      </button>
      {!isFile && open && (
        <ul role="group">
          {(data?.inodes || [])
            .filter((n) => n.kind === "dir")
            .map((child) => (
              <TreeNode
                key={child.id}
                volumeId={volumeId}
                inode={child}
                selectedId={selectedId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            ))}
        </ul>
      )}
    </li>
  )
}
