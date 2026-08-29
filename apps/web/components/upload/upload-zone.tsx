"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Upload as UploadIcon, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import { derive_chunk_key, derive_master_key, encrypt_chunk, fromB64 } from "@/lib/crypto/core"
import { generateEncryptedThumbnail } from "@/lib/crypto/thumbnail"
import { usePassphrasePrompt } from "@/components/providers/passphrase-prompt-provider"
import { encodeShards } from "@/lib/erasure"
import type { ChunkAllocationResponse } from "@/lib/shards"
import type { Inode, MediaMetadata } from "@/lib/types"
import {
  incompatibleAudioMessage,
  prepareUploadFiles,
} from "@/lib/media/upload-preflight"
import { isLikelyVideoFile } from "@/lib/media/probe"

export interface UploadZoneProps {
  volumeId: string
  parentId?: string | null
  kdfSalt: string | null // base64
  onUploadComplete?: (inodeId: string) => void
}

interface FileProgress {
  name: string
  total: number
  uploaded: number
  status: "queued" | "encrypting" | "uploading" | "complete" | "error" | "cancelled"
  abort: AbortController
  inodeId?: string
}

export function UploadZone({ volumeId, parentId = null, kdfSalt, onUploadComplete }: UploadZoneProps) {
  const { requestPassphrase } = usePassphrasePrompt()
  const [files, setFiles] = useState<FileProgress[]>([])

  const processFile = useCallback(
    async (
      file: File,
      idx: number,
      abort: AbortController,
      masterKey: CryptoKey,
      mediaMetadata: MediaMetadata | null,
      isVideo: boolean,
      mimeType: string,
    ) => {
      if (!kdfSalt) {
        toast.error("Volume has no KDF salt set")
        return
      }
      setFiles((prev) =>
        prev.map((f, i) => (i === idx ? { ...f, status: "encrypting" } : f)),
      )

      let inodeId: string | undefined;
      try {
        
        // 1. Generate encrypted thumbnail if it's an image
        const thumbnail_b64 = await generateEncryptedThumbnail(file, masterKey, volumeId)
        
        const inode = await api<Inode>("/api/inodes", {
          method: "POST",
          body: JSON.stringify({
            volume_id: volumeId,
            parent_id: parentId,
            name: file.name,
            kind: "file",
            size_bytes: file.size,
            mime_type: mimeType,
            media_metadata: mediaMetadata,
            thumbnail: thumbnail_b64 || undefined,
          }),
          signal: abort.signal,
        })
        inodeId = inode.id
        setFiles((prev) =>
          prev.map((f, i) => (i === idx ? { ...f, status: "uploading", inodeId: inode.id } : f)),
        )

        // 2. Hybrid Chunking Architecture
        // - Videos: 5MB chunks (to allow Range Request streaming)
        // - Others: 1 massive chunk (for clean storage)
        const dynamicChunkSize = isVideo ? (5 * 1024 * 1024) : Math.max(1, file.size)
        const totalChunks = Math.max(1, Math.ceil(file.size / dynamicChunkSize))
        
        let totalShardsPerChunk = 0;
        let globalCompletedShards = 0;
        
        // Update UI to show 0% progress initially
        setFiles((prev) => prev.map((f, j) => (j === idx ? { ...f, total: totalChunks * 14, uploaded: 0 } : f)))
        
        for (let i = 0; i < totalChunks; i++) {
          if (abort.signal.aborted) throw new Error("cancelled")
          const start = i * dynamicChunkSize
          const end = Math.min(start + dynamicChunkSize, file.size)
          const slice = new Uint8Array(await file.slice(start, end).arrayBuffer())
          const chunkKey = await derive_chunk_key(masterKey, volumeId, i)
          const { iv, ciphertext } = await encrypt_chunk(slice, chunkKey)

          // Wire format: [iv(12) | ciphertext]
          const body = new Uint8Array(iv.length + ciphertext.length)
          body.set(iv, 0)
          body.set(ciphertext, iv.length)

          // 1. Locally encode into 14 shards using WebAssembly!
          const encoded = await encodeShards(body)

          // 2. Ask Next.js/Go backend to allocate 14 shard slots for us
          const { allocation } = await api<ChunkAllocationResponse>(`/api/jobs/chunk`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Aether-Inode-Id": inode.id,
              "X-Aether-Version-Id": (inode as any).versionId || "",
              "X-Aether-Chunk-Index": String(i),
              "X-Aether-Chunk-Size": String(body.length),
            },
            signal: abort.signal,
          })

          // 3. Upload the 14 shards perfectly in parallel!
          const maxConcurrent = 8; // Increased from 3 to 8 per user request
          let running = 0;
          let currentIndex = 0;
          const totalShards = allocation.allocations.length;
          
          await new Promise<void>((resolve, reject) => {
            const runNext = () => {
              if (currentIndex >= totalShards && running === 0) {
                return resolve()
              }
              if (abort.signal.aborted) {
                return reject(new Error("cancelled"))
              }

              while (running < maxConcurrent && currentIndex < totalShards) {
                const idxShard = currentIndex++;
                const shard = allocation.allocations[idxShard];

                if (idxShard >= encoded.shards.length) continue;

                running++;
                const formData = new FormData();
                formData.append("file", new Blob([encoded.shards[idxShard] as any]), `shard_${i}_${idxShard}`);
                formData.append("shardId", String(shard.shardId));

                fetch(`/api/jobs/shard`, {
                  method: "POST",
                  body: formData,
                  signal: abort.signal,
                })
                  .then(async (res) => {
                    if (!res.ok) {
                      const errText = await res.text().catch(() => "Upload failed");
                      throw new Error(`Shard ${idxShard} upload failed: ${errText}`);
                    }
                  })
                  .then(() => {
                    running--;
                    globalCompletedShards++;
                    // Increment the progress bar for each parallel shard that finishes
                    setFiles((prev) => prev.map((f, j) => (j === idx ? { ...f, uploaded: globalCompletedShards } : f)))
                    runNext();
                  })
                  .catch((err) => {
                    abort.abort();
                    reject(err);
                  });
              }
            };
            runNext();
          });
        }

        setFiles((prev) =>
          prev.map((f, j) => (j === idx ? { ...f, status: "complete" } : f)),
        )
        onUploadComplete?.(inode.id)
        toast.success(`${file.name} encrypted and uploaded (${totalChunks} chunks)`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed"
        
        // CLEANUP GHOST FILE
        if (inodeId) {
          api(`/api/inodes/${inodeId}`, { method: "DELETE" }).catch(err => console.error("Cleanup failed:", err))
        }

        setFiles((prev) =>
          prev.map((f, j) =>
            j === idx ? { ...f, status: msg === "cancelled" ? "cancelled" : "error" } : f,
          ),
        )
        if (msg !== "cancelled") toast.error(msg)
      }
    },
    [volumeId, parentId, kdfSalt, onUploadComplete],
  )
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!kdfSalt) {
        toast.error("Volume has no KDF salt set")
        return
      }

      const validFiles: File[] = []
      for (const f of acceptedFiles) {
        const isVideo = isLikelyVideoFile(f)
        const maxSize = isVideo ? (1024 * 1024 * 1024) : (100 * 1024 * 1024) // 1GB for videos, 100MB for others
        
        if (f.size > maxSize) {
          toast.error(`File ${f.name} exceeds the ${isVideo ? "1GB" : "100MB"} limit.`)
        } else {
          validFiles.push(f)
        }
      }

      if (validFiles.length === 0) return;
      const preparedFiles = await prepareUploadFiles(validFiles)
      for (const prepared of preparedFiles) {
        const warning = incompatibleAudioMessage(prepared)
        if (warning) toast.warning(warning, { duration: 10_000 })
      }

      let pass = ""
      try {
        pass = await requestPassphrase("Upload Files", `Enter passphrase for volume to encrypt ${validFiles.length} file(s).`)
      } catch (err) {
        return // Cancelled by user
      }

      const { masterKey } = await derive_master_key(pass, fromB64(kdfSalt))
      // Explicitly clear string from local scope, although GC handles it
      pass = ""

      const startIdx = files.length
      const entries = preparedFiles.map(() => new AbortController())
      setFiles((prev) => [
        ...prev,
        ...preparedFiles.map((prepared, j) => ({
          name: prepared.file.name,
          total: 1, // Always 1 chunk
          uploaded: 0,
          status: "queued" as const,
          abort: entries[j],
        })),
      ])
      
      for (let i = 0; i < preparedFiles.length; i++) {
        if (!entries[i].signal.aborted) {
          const prepared = preparedFiles[i]
          await processFile(
            prepared.file,
            startIdx + i,
            entries[i],
            masterKey,
            prepared.mediaMetadata,
            prepared.isVideo,
            prepared.mimeType,
          )
        }
      }
    },
    [processFile, files.length, kdfSalt, requestPassphrase],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className="flex flex-col gap-3">
      <div
        {...getRootProps()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <UploadIcon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">
          {isDragActive ? "Drop files to encrypt" : "Drop files or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          1 MB chunks. Encrypted client-side with AES-256-GCM.
        </p>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-md border bg-card p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{f.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {f.uploaded}/{f.total} {f.status}
                  </span>
                  {(f.status === "uploading" || f.status === "encrypting") && (
                    <Button size="sm" variant="ghost" onClick={() => f.abort.abort()}>
                      <X className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Cancel</span>
                    </Button>
                  )}
                </div>
              </div>
              <Progress value={(f.uploaded / f.total) * 100} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
