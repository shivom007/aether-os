"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ChunkMap } from "./chunk-map"
import { UploadZone } from "@/components/upload/upload-zone"
import { UploadZoneBatch } from "@/components/upload/upload-zone-batch"
import { api } from "@/lib/api"
import { formatBytes, relativeTime } from "@/lib/format"
import type { Volume, Inode } from "@/lib/types"
import { FolderOpen } from "lucide-react"

export function VolumeDrawer({
  volumeId,
  onClose,
}: {
  volumeId: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()

  const { data: volume } = useQuery({
    queryKey: ["volume", volumeId],
    queryFn: () => api<Volume>(`/api/volumes/${volumeId}`),
    enabled: !!volumeId,
  })

  const { data: shards } = useQuery({
    queryKey: ["volume-shards", volumeId],
    queryFn: () =>
      api<Array<{ index: number; provider_type: string; parity: boolean }>>(
        `/api/volumes/${volumeId}?shards=1`,
      ),
    enabled: !!volumeId,
  })

  const { data: inodesData } = useQuery({
    queryKey: ["volume-inodes", volumeId, null],
    queryFn: () => api<{ inodes: Inode[]; root_id: string | null }>(`/api/inodes/volume/${volumeId}`),
    enabled: !!volumeId,
  })
  const inodes = inodesData?.inodes

  return (
    <Sheet open={!!volumeId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{volume?.name ?? "Loading…"}</SheetTitle>
          <SheetDescription>{volume?.description || "No description"}</SheetDescription>
        </SheetHeader>

        {volume && (
          <div className="mt-4 flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Volume ID</dt>
                <dd className="font-mono text-xs">{volume.id.slice(0, 13)}…</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd>{relativeTime(volume.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Logical size</dt>
                <dd className="tabular-nums">{formatBytes(volume.logical_size_bytes)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">KDF salt</dt>
                <dd className="font-mono text-xs">{volume.kdf_salt?.slice(0, 12) ?? "—"}…</dd>
              </div>
            </dl>

            <Tabs defaultValue="files">
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="shards">Shards</TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="mt-3">
                <div className="rounded-md border">
                  {inodes && inodes.length > 0 ? (
                    <ul className="divide-y">
                      {inodes.map((n) => (
                        <li key={n.id} className="flex items-center justify-between p-3 text-sm">
                          <span className="truncate">{n.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {n.kind === "dir" ? "dir" : formatBytes(n.size_bytes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground">No files yet.</p>
                  )}
                </div>
                <Separator className="my-3" />
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href={`/dashboard/volumes/${volume.id}/browse`}>
                    <FolderOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                    Open file browser
                  </Link>
                </Button>
              </TabsContent>

              <TabsContent value="upload" className="mt-3">
                <UploadZone
                  volumeId={volume.id}
                  kdfSalt={volume.kdf_salt}
                  onUploadComplete={() => {
                    qc.invalidateQueries({ queryKey: ["volume-inodes", volume.id, null] })
                    qc.invalidateQueries({ queryKey: ["volumes"] })
                  }}
                />
              </TabsContent>

              <TabsContent value="batch" className="mt-3">
                <UploadZoneBatch
                  volumeId={volume.id}
                  kdfSalt={volume.kdf_salt}
                  onUploadComplete={() => {
                    qc.invalidateQueries({ queryKey: ["volume-inodes", volume.id, null] })
                    qc.invalidateQueries({ queryKey: ["volumes"] })
                  }}
                />
              </TabsContent>

              <TabsContent value="shards" className="mt-3">
                <ChunkMap shards={shards ?? []} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
