"use client"

import { useState, useEffect } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Folder, FileIcon, Search, MoreVertical, Download, Trash2, Maximize2, Play, Info, Image as ImageIcon, List, LayoutGrid } from "lucide-react"
import { usePassphrasePrompt } from "@/components/providers/passphrase-prompt-provider"
import { derive_master_key, fromB64 } from "@/lib/crypto/core"
import { derive_master_key_v2 } from "@/lib/crypto/core-v2"
import { StreamingEngine } from "@/components/browser/streaming-engine"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Checkbox } from "@/components/ui/checkbox"
import { api } from "@/lib/api"
import { formatBytes, relativeTime } from "@/lib/format"
import type { Inode } from "@/lib/types"
import { EncryptedThumbnail } from "./encrypted-thumbnail"
import { useDownloadStore } from "@/stores/download-store"

export function FileList({
  volumeId,
  parentId,
  onSelect,
  selectedId,
  kdfSalt,
  engine = "v1",
}: {
  volumeId: string
  parentId: string | null
  onSelect: (n: Inode) => void
  selectedId?: string
  kdfSalt: string | null
  engine?: "v1" | "v2"
}) {
  const qc = useQueryClient()
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const { requestPassphrase } = usePassphrasePrompt()
  const [playingVideo, setPlayingVideo] = useState<{ inode: Inode; masterKey: CryptoKey } | null>(null)
  const [thumbnailMasterKey, setThumbnailMasterKey] = useState<CryptoKey | null>(null)
  const [isSwReady, setIsSwReady] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set((data?.inodes ?? []).map((n) => n.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkDownload = async () => {
    if (!kdfSalt) {
      toast.error("Volume has no KDF salt set")
      return
    }

    let pass = ""
    try {
      pass = await requestPassphrase("Bulk Download", `Enter volume passphrase to decrypt and download ${selectedIds.size} file(s).`)
    } catch (e) {
      return // user cancelled
    }

    const { masterKey } = await derive_master_key(pass, fromB64(kdfSalt))
    pass = ""

    const store = useDownloadStore.getState()
    const inodesList = data?.inodes ?? []
    let count = 0
    for (const id of selectedIds) {
      const node = inodesList.find((n) => n.id === id)
      if (node && node.kind !== "dir") {
        store.enqueue(node, volumeId, masterKey, kdfSalt, engine)
        count++
      }
    }
    if (count > 0) toast.success(`Queued ${count} files for download`)
    clearSelection()
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} items?`)) return
    
    const promises = Array.from(selectedIds).map((id) => 
      api(`/api/inodes/${id}`, { method: "DELETE" })
    )
    
    try {
      await Promise.all(promises)
      toast.success(`Deleted ${selectedIds.size} items`)
      qc.invalidateQueries({ queryKey: ["inodes-children"] })
      qc.invalidateQueries({ queryKey: ["inodes-root", volumeId] })
      clearSelection()
    } catch (e) {
      toast.error("Failed to delete some items")
    }
  }

  // Ensure Service Worker is controlling the page before trying to stream
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    
    // Register SW globally for the browser
    navigator.serviceWorker.register("/sw.js").then(() => {
      // Sometimes it's ready immediately after register if it was already installed
      if (navigator.serviceWorker.controller) {
        setIsSwReady(true)
      }
    })
    
    if (navigator.serviceWorker.controller) {
      setIsSwReady(true)
    }
    
    const handleControllerChange = () => setIsSwReady(true)
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
    
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
  }, [])

  const handlePlayVideo = async (inode: Inode) => {
    if (!kdfSalt) return toast.error("Volume has no KDF salt")
    
    // --- JIT Prompt-Time Prefetch ---
    // Start downloading the encrypted shards for the first chunk in the background 
    // *while* the user is typing their passphrase.
    ;(async () => {
      try {
        const { streamingMetaCache, prefetchShardCache } = await import("./streaming-engine")
        const data = await api<any>(`/api/inodes/${inode.id}`)
        if (data.inode && data.chunks) {
          streamingMetaCache.set(inode.id, { inode: data.inode, chunks: data.chunks })
          
          const targetShards = data.chunks.filter((c: any) => c.chunk_index === 0)
          const dataShardsToPrefetch = [...targetShards].sort((a, b) => a.shard_index - b.shard_index).slice(0, 10)

          for (const shard of dataShardsToPrefetch) {
            if (!prefetchShardCache.has(shard.id)) {
              const fetchPromise = fetch(`/api/shards/${shard.id}`)
                .then(res => {
                  if (!res.ok) throw new Error(`Prefetch failed with ${res.status}`)
                  return res.arrayBuffer()
                })
                .then(ab => new Uint8Array(ab))
                // Do not catch and return an empty Uint8Array here!
                // Let it reject so streaming-engine's fetchMinimumShards knows to fallback to parity shards.
              
              prefetchShardCache.set(shard.id, fetchPromise)
            }
          }
        }
      } catch (e) {
        // Silently fail prefetch if network issues occur, streaming engine will retry
      }
    })()
    
    let pass = ""
    try {
      pass = await requestPassphrase("Stream Video", "Enter your volume passphrase to decrypt this video stream on the fly.")
    } catch (e) {
      return
    }

    // Use the correct key derivation function based on the volume engine
    const saltBytes = fromB64(kdfSalt)
    const { masterKey } = engine === "v2"
      ? await derive_master_key_v2(pass, saltBytes)
      : await derive_master_key(pass, saltBytes)
    pass = ""
    setPlayingVideo({ inode, masterKey })
  }

  const { data, isLoading } = useQuery({
    queryKey: ["inodes-children", volumeId, parentId],
    queryFn: () =>
      api<{ inodes: Inode[]; root_id: string | null }>(
        parentId
          ? `/api/inodes/volume/${volumeId}?parent_id=${parentId}`
          : `/api/inodes/volume/${volumeId}`,
      ),
  })

  const del = useMutation({
    mutationFn: (id: string) => api(`/api/inodes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Inode deleted")
      qc.invalidateQueries({ queryKey: ["inodes-children"] })
      qc.invalidateQueries({ queryKey: ["inodes-root", volumeId] })
    },
  })

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const inodes = data?.inodes ?? []
  if (inodes.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Folder />
          </EmptyMedia>
          <EmptyTitle>Empty folder</EmptyTitle>
          <EmptyDescription>Upload files to this directory to see them here.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const hasThumbnails = inodes.some(n => !!n.thumbnail_b64)

  const handleUnlockThumbnails = async () => {
    if (!kdfSalt) return
    let pass = ""
    try {
      pass = await requestPassphrase("Unlock Thumbnails", "Enter volume passphrase to decrypt thumbnails for this folder.")
    } catch {
      return
    }
    const { masterKey: key } = await derive_master_key(pass, fromB64(kdfSalt))
    pass = ""
    setThumbnailMasterKey(key)
    setTimeout(() => setThumbnailMasterKey(null), 2000) // Wipe from memory
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b bg-muted/20">
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground px-2">{inodes.length} items</span>
          {hasThumbnails && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleUnlockThumbnails}>
              <ImageIcon className="mr-2 h-3 w-3" />
              Unlock Thumbnails
            </Button>
          )}
        </div>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} size="sm">
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-2 border-b bg-primary/10">
          <span className="text-sm font-medium px-2">{selectedIds.size} selected</span>
          <Button variant="secondary" size="sm" onClick={handleBulkDownload}>
            <Download className="mr-2 h-4 w-4" /> Download Selected
          </Button>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {viewMode === "list" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    checked={inodes.length > 0 && selectedIds.size === inodes.length}
                    onCheckedChange={(checked) => toggleAll(!!checked)}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inodes.map((n) => (
                <ContextMenu key={n.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      data-selected={selectedId === n.id}
                      className={`cursor-pointer ${selectedId === n.id ? "bg-accent/50" : ""}`}
                      onClick={() => {
                        if (n.mime_type?.startsWith("video/")) {
                          handlePlayVideo(n)
                        } else {
                          onSelect(n)
                        }
                      }}
                    >
                      <TableCell className="w-[40px] text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(n.id)}
                          onCheckedChange={(checked) => toggleOne(n.id, !!checked)}
                          aria-label={`Select ${n.name}`}
                        />
                      </TableCell>
                      <TableCell className="flex items-center gap-3">
                        {n.kind === "dir" ? (
                          <Folder className="size-5 text-muted-foreground" aria-hidden />
                        ) : n.thumbnail_b64 ? (
                          <EncryptedThumbnail volumeId={volumeId} thumbnailB64={n.thumbnail_b64} masterKey={thumbnailMasterKey} className="size-6 rounded object-cover" />
                        ) : (
                          <FileIcon className="size-5 text-muted-foreground" aria-hidden />
                        )}
                        <span className="truncate">{n.name}</span>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {n.kind === "dir" ? "—" : formatBytes(n.size_bytes)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {relativeTime(n.updated_at)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelect(n)}
                        >
                          <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
                          <span className="sr-only">Details</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete ${n.name}?`)) del.mutate(n.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onSelect(n)}>
                      <Info className="mr-2 size-4" aria-hidden /> Properties
                    </ContextMenuItem>
                    <ContextMenuItem onClick={async () => {
                      if (!kdfSalt) {
                        toast.error("Volume has no KDF salt set")
                        return
                      }
                      let pass = ""
                      try {
                        pass = await requestPassphrase("Download File", `Enter volume passphrase to decrypt and download ${n.name}.`)
                      } catch {
                        return
                      }
                      const { masterKey } = await derive_master_key(pass, fromB64(kdfSalt))
                      pass = ""
                      useDownloadStore.getState().enqueue(n, volumeId, masterKey, kdfSalt, engine)
                      toast.success("Added to download queue")
                    }}>
                      <Download className="mr-2 size-4" aria-hidden /> Download
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => {
                        if (confirm(`Delete ${n.name}?`)) del.mutate(n.id)
                      }}
                    >
                      <Trash2 className="mr-2 size-4" aria-hidden /> Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {inodes.map((n) => (
              <ContextMenu key={n.id}>
                <ContextMenuTrigger asChild>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:bg-accent/50 ${selectedId === n.id ? "ring-2 ring-primary border-transparent" : ""}`}
                    onClick={() => {
                      if (n.mime_type?.startsWith("video/")) {
                        handlePlayVideo(n)
                      } else {
                        onSelect(n)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (n.mime_type?.startsWith("video/")) {
                          handlePlayVideo(n)
                        } else {
                          onSelect(n)
                        }
                      }
                    }}
                  >
                    <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: selectedIds.has(n.id) ? 1 : undefined }}>
                      <Checkbox
                        checked={selectedIds.has(n.id)}
                        onCheckedChange={(checked) => toggleOne(n.id, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background shadow-sm"
                        aria-label={`Select ${n.name}`}
                      />
                    </div>
                    <div className="flex aspect-square w-full items-center justify-center bg-muted/30">
                      {n.kind === "dir" ? (
                        <Folder className="size-16 text-muted-foreground/50" />
                      ) : n.thumbnail_b64 ? (
                        <EncryptedThumbnail volumeId={volumeId} thumbnailB64={n.thumbnail_b64} masterKey={thumbnailMasterKey} className="w-full h-full object-cover" />
                      ) : (
                        <FileIcon className="size-16 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 p-3">
                      <span className="truncate text-sm font-medium" title={n.name}>{n.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {n.kind === "dir" ? "Folder" : formatBytes(n.size_bytes)}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1.5 top-1.5 opacity-0 bg-background/80 hover:bg-background transition-opacity group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete ${n.name}?`)) del.mutate(n.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onSelect(n)}>
                    <Info className="mr-2 size-4" aria-hidden /> Properties
                  </ContextMenuItem>
                  <ContextMenuItem onClick={async () => {
                    if (!kdfSalt) {
                      toast.error("Volume has no KDF salt set")
                      return
                    }
                    let pass = ""
                    try {
                      pass = await requestPassphrase("Download File", `Enter volume passphrase to decrypt and download ${n.name}.`)
                    } catch {
                      return
                    }
                    const { masterKey } = await derive_master_key(pass, fromB64(kdfSalt))
                    pass = ""
                    useDownloadStore.getState().enqueue(n, volumeId, masterKey, kdfSalt, engine)
                    toast.success("Added to download queue")
                  }}>
                    <Download className="mr-2 size-4" aria-hidden /> Download
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      if (confirm(`Delete ${n.name}?`)) del.mutate(n.id)
                    }}
                  >
                    <Trash2 className="mr-2 size-4" aria-hidden /> Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!playingVideo} onOpenChange={(open) => !open && setPlayingVideo(null)}>
        <DialogContent className="max-w-4xl bg-black border-zinc-800 p-0 text-white overflow-hidden">
          <DialogHeader className="absolute top-0 left-0 w-full z-10 flex flex-row items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 opacity-0 transition-opacity hover:opacity-100">
            <DialogTitle>{playingVideo?.inode.name}</DialogTitle>
            <DialogDescription className="sr-only">Video Player</DialogDescription>
            {playingVideo && (
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={() => {
                  onSelect(playingVideo.inode)
                  setPlayingVideo(null)
                }}
              >
                <Info className="mr-2 size-4" /> Details & Download
              </Button>
            )}
          </DialogHeader>
          {playingVideo && (
            isSwReady ? (
              <>
                <StreamingEngine volumeId={volumeId} masterKey={playingVideo.masterKey} engine={engine} kdfSalt={kdfSalt} />
                <video 
                  controls 
                  autoPlay 
                  src={`/stream/${playingVideo.inode.id}`} 
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              </>
            ) : (
              <div className="flex flex-col h-[400px] w-full items-center justify-center text-muted-foreground bg-zinc-900/50 gap-4">
                <p>Initializing secure streaming engine...</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Click here to reload page if stuck
                </Button>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
