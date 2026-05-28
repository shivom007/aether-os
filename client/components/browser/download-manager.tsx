"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { X, Download as DownloadIcon, FileIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useDownloadStore } from "@/stores/download-store"
import { api } from "@/lib/api"
import { derive_chunk_key, decrypt_chunk } from "@/lib/crypto/core"
import { reconstructShards, DATA_SHARDS, TOTAL_SHARDS, fetchMinimumShards } from "@/lib/erasure"
import type { Inode, PhysicalChunk } from "@/lib/types"

export function DownloadManager() {
  const queue = useDownloadStore((s) => s.queue)
  const updateTask = useDownloadStore((s) => s.updateTask)
  const remove = useDownloadStore((s) => s.remove)
  const clearCompleted = useDownloadStore((s) => s.clearCompleted)
  
  const isProcessing = useRef(false)

  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing.current) return
      
      const nextTask = queue.find((t) => t.status === "queued")
      if (!nextTask) return

      isProcessing.current = true
      updateTask(nextTask.id, { status: "downloading", progress: 0 })

      try {
        const { chunks } = await api<{ inode: Inode; chunks: PhysicalChunk[] }>(`/api/inodes/${nextTask.inode.id}`)
        if (!chunks || chunks.length === 0) {
          throw new Error("No chunks available to download")
        }

        const masterKey = nextTask.masterKey
        
        const chunksMap = new Map<number, PhysicalChunk[]>()
        for (const c of chunks) {
          if (!chunksMap.has(c.chunk_index)) {
            chunksMap.set(c.chunk_index, [])
          }
          chunksMap.get(c.chunk_index)!.push(c)
        }

        const totalChunks = chunksMap.size
        const chunkData: Uint8Array[] = []

        const globalTotalShards = totalChunks * DATA_SHARDS
        let globalDownloadedShards = 0

        for (let i = 0; i < totalChunks; i++) {
          const chunkShards = chunksMap.get(i)
          if (!chunkShards) throw new Error(`Chunk ${i} is entirely missing from the database.`)

          const fetchedShards = await fetchMinimumShards(
            chunkShards,
            async (shardId, signal) => {
              const res = await fetch(`/api/shards/${shardId}`, { signal })
              if (!res.ok) throw new Error("Shard fetch failed")
              const buffer = await res.arrayBuffer()
              return new Uint8Array(buffer)
            },
            () => {
              // onProgress callback
              globalDownloadedShards++
              updateTask(nextTask.id, { progress: Math.min(100, (globalDownloadedShards / globalTotalShards) * 100) })
            }
          )
          
          const isLastChunk = i === totalChunks - 1
          const isVideo = nextTask.inode.mime_type?.startsWith("video/")
          const dynamicChunkSize = isVideo ? (5 * 1024 * 1024) : Math.max(1, nextTask.inode.size_bytes)
          
          let unencryptedSize = dynamicChunkSize
          if (isLastChunk) {
            if (nextTask.inode.size_bytes === 0) {
              unencryptedSize = 0
            } else if (nextTask.inode.size_bytes % dynamicChunkSize !== 0) {
              unencryptedSize = nextTask.inode.size_bytes % dynamicChunkSize
            }
          }
          
          const originalSize = unencryptedSize + 16 + 12
          const reconstructed = await reconstructShards(fetchedShards, originalSize)

          const iv = reconstructed.slice(0, 12)
          const ciphertext = reconstructed.slice(12)

          const chunkKey = await derive_chunk_key(masterKey, nextTask.volumeId, i)
          const plaintext = await decrypt_chunk(ciphertext, iv, chunkKey)
          
          chunkData.push(plaintext)
        }

        const mime = nextTask.inode.mime_type || "application/octet-stream"
        const blob = new Blob(chunkData as any[], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = nextTask.inode.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success(`${nextTask.inode.name} downloaded`)
        updateTask(nextTask.id, { status: "complete", progress: 100 })
      } catch (err) {
        console.error(err)
        const msg = (err as Error).message
        toast.error(`Download failed: ${msg}`)
        updateTask(nextTask.id, { status: "error", error: msg })
      } finally {
        isProcessing.current = false
      }
    }

    processQueue()
  }, [queue, updateTask])

  if (queue.length === 0) return null

  const activeCount = queue.filter(t => t.status === "downloading" || t.status === "queued").length

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card shadow-lg flex flex-col overflow-hidden max-h-96">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b">
        <span className="text-sm font-medium flex items-center gap-2">
          <DownloadIcon className="h-4 w-4" />
          Downloads ({activeCount} active)
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCompleted}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {queue.map((task) => (
          <li key={task.id} className="flex flex-col gap-1 p-2 rounded border bg-background text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium flex items-center gap-1.5">
                <FileIcon className="h-3 w-3 text-muted-foreground" />
                {task.inode.name}
              </span>
              <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0" onClick={() => remove(task.id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{task.status === "error" ? "Failed" : task.status}</span>
              {task.status === "downloading" && <span>{Math.round(task.progress)}%</span>}
            </div>
            {(task.status === "downloading" || task.status === "queued") && (
              <Progress value={task.progress} className="h-1" />
            )}
            {task.status === "error" && (
              <p className="text-[10px] text-destructive leading-tight">{task.error}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
