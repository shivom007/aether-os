"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { X, Download as DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { api } from "@/lib/api"
import { formatBytes, relativeTime } from "@/lib/format"
import type { Inode, PhysicalChunk } from "@/lib/types"
import { derive_master_key, fromB64 } from "@/lib/crypto/core"
import { usePassphrasePrompt } from "@/components/providers/passphrase-prompt-provider"
import { reconstructShards, DATA_SHARDS, TOTAL_SHARDS } from "@/lib/erasure"
import { FileIcon } from "lucide-react"
import { useDownloadStore } from "@/stores/download-store"

export function FileDetailPanel({ 
  inode, 
  volumeId,
  kdfSalt,
  engine = "v1",
  onClose 
}: { 
  inode: Inode | null; 
  volumeId: string;
  kdfSalt: string | null;
  engine?: "v1" | "v2";
  onClose: () => void;
}) {
  const { requestPassphrase } = usePassphrasePrompt()
  const { data } = useQuery({
    queryKey: ["inode-detail", inode?.id],
    queryFn: () => api<{ inode: Inode; chunks: PhysicalChunk[] }>(`/api/inodes/${inode!.id}`),
    enabled: !!inode && inode.kind === "file",
    refetchInterval: 5_000,
  })

  if (!inode) {
    return (
      <div className="rounded-lg border bg-card">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileIcon />
            </EmptyMedia>
            <EmptyTitle>No file selected</EmptyTitle>
            <EmptyDescription>Pick a file from the list to inspect its shard layout.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  const chunks = data?.chunks ?? []
  const mime = inferMime(inode.name)
  const isVideo = mime.startsWith("video/")

  const handleDownload = async () => {
    if (!kdfSalt) {
      toast.error("Volume has no KDF salt set")
      return
    }
    let pass = ""
    try {
      pass = await requestPassphrase("Download File", `Enter volume passphrase to decrypt and download ${inode.name}.`)
    } catch (e) {
      return // user cancelled
    }
    
    const { masterKey } = await derive_master_key(pass, fromB64(kdfSalt))
    pass = ""
    
    useDownloadStore.getState().enqueue(inode, volumeId, masterKey, kdfSalt, engine)
    toast.success("Added to download queue")
    onClose()
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{inode.name}</h3>
          <p className="text-xs text-muted-foreground">
            {formatBytes(inode.size_bytes)} · {mime} · updated {relativeTime(inode.updated_at)}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close detail panel">
          <X className="size-4" />
        </Button>
      </div>

      <div className="my-4 flex items-center justify-center p-8 bg-muted rounded-lg">
        <FileIcon className="size-16 text-muted-foreground" />
      </div>

      <Separator className="my-3" />

      <div className="flex flex-col gap-2">

        <Button
          className="w-full"
          onClick={handleDownload}
        >
          <DownloadIcon className="mr-2 size-4" aria-hidden /> 
          Download
        </Button>
      </div>

      <Separator className="my-3" />

      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Physical chunks ({chunks.length})
      </h4>
      {chunks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Upload in progress or not yet queued.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Idx</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Remote ID</TableHead>
                <TableHead>Checksum</TableHead>
                <TableHead className="text-right">Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunks.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">
                    {c.chunk_index}.{c.shard_index}
                  </TableCell>
                  <TableCell className="uppercase text-xs">{c.provider_type || "—"}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {c.remote_object_id.slice(-12)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">{c.checksum_sha256.slice(0, 8)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{formatBytes(c.size_bytes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function inferMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    zip: "application/zip",
    html: "text/html",
  }
  return map[ext] || "application/octet-stream"
}
