"use client"

import { use, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Inode, Volume } from "@/lib/types"
import { FileTree } from "@/components/browser/file-tree"
import { FileList } from "@/components/browser/file-list"
import { FileDetailPanel } from "@/components/browser/file-detail-panel"
import { UploadZone } from "@/components/upload/upload-zone"

export default function BrowsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: volumeId } = use(params)
  const [currentDirId, setCurrentDirId] = useState<string | null>(null)
  const [selectedInode, setSelectedInode] = useState<Inode | null>(null)
  const qc = useQueryClient()

  const { data: volume } = useQuery({
    queryKey: ["volume", volumeId],
    queryFn: () => api<Volume>(`/api/volumes/${volumeId}`),
  })

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{volume?.name ?? "Browse"}</h1>
        <p className="text-sm text-muted-foreground">
          Files are end-to-end encrypted. Downloads reconstruct from erasure-coded shards.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_360px] min-w-0">
        <aside className="md:sticky md:top-28 md:self-start">
          <FileTree
            volumeId={volumeId}
            selectedId={currentDirId}
            onSelect={(id) => setCurrentDirId(id)}
          />
          <div className="mt-4 rounded-lg border bg-card p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Upload to this volume</p>
            <UploadZone
              volumeId={volumeId}
              parentId={currentDirId}
              kdfSalt={volume?.kdf_salt ?? null}
              onUploadComplete={() => {
                qc.invalidateQueries({ queryKey: ["inodes-children"] })
                qc.invalidateQueries({ queryKey: ["inodes-root", volumeId] })
                qc.invalidateQueries({ queryKey: ["volume-inodes", volumeId] })
              }}
            />
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-lg border bg-card">
          <FileList
            volumeId={volumeId}
            parentId={currentDirId}
            onSelect={setSelectedInode}
            selectedId={selectedInode?.id}
            kdfSalt={volume?.kdf_salt ?? null}
          />
        </section>

        <aside className="xl:block">
          <FileDetailPanel
            inode={selectedInode}
            volumeId={volumeId}
            kdfSalt={volume?.kdf_salt ?? null}
            onClose={() => setSelectedInode(null)}
          />
        </aside>
      </div>
    </div>
  )
}
