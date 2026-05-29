"use client"

import { useCallback } from "react"
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
import type { Inode } from "@/lib/types"
import { useUploadStore } from "@/lib/store/upload-store"

export interface UploadZoneGlobalProps {
  volumeId: string
  kdfSalt: string | null // base64
  onUploadComplete?: (inodeId: string) => void
}

export function UploadZoneGlobal({ volumeId, kdfSalt, onUploadComplete }: UploadZoneGlobalProps) {
  const { requestPassphrase } = usePassphrasePrompt()
  const { files, addFiles, updateFile, abortFile } = useUploadStore()
  
  // Filter files that belong to this volume
  const volumeFiles = Object.values(files).filter(f => f.volumeId === volumeId)

  // This runs completely independently of the React lifecycle!
  const processFile = async (
    file: File,
    fileId: string,
    abort: AbortController,
    masterKey: CryptoKey,
    vId: string
  ) => {
    updateFile(fileId, { status: "encrypting" })

    let inodeId: string | undefined;
    try {
      const thumbnail_b64 = await generateEncryptedThumbnail(file, masterKey, vId)
      
      const inode = await api<Inode>("/api/inodes", {
        method: "POST",
        body: JSON.stringify({
          volume_id: vId,
          name: file.name,
          kind: "file",
          size_bytes: file.size,
          mime_type: file.type,
          thumbnail: thumbnail_b64 || undefined,
        }),
        signal: abort.signal,
      })
      inodeId = inode.id
      updateFile(fileId, { status: "uploading", inodeId: inode.id })

      const isVideo = file.type.startsWith("video/")
      const dynamicChunkSize = isVideo ? (5 * 1024 * 1024) : Math.max(1, file.size)
      const totalChunks = Math.max(1, Math.ceil(file.size / dynamicChunkSize))
      
      const totalShardsForFile = totalChunks * 14;
      let globalCompletedShards = 0;
      
      updateFile(fileId, { total: totalShardsForFile, uploaded: 0 })
      
      for (let i = 0; i < totalChunks; i++) {
        if (abort.signal.aborted) throw new Error("cancelled")
        const start = i * dynamicChunkSize
        const end = Math.min(start + dynamicChunkSize, file.size)
        const slice = new Uint8Array(await file.slice(start, end).arrayBuffer())
        const chunkKey = await derive_chunk_key(masterKey, vId, i)
        const { iv, ciphertext } = await encrypt_chunk(slice, chunkKey)

        const body = new Uint8Array(iv.length + ciphertext.length)
        body.set(iv, 0)
        body.set(ciphertext, iv.length)

        const encoded = await encodeShards(body)

        // BATCH ALLOCATION
        const { allocation } = await api<{ jobId: string; status: string; allocation: any }>(`/api/jobs/chunk/batch`, {
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

        // UPLOAD ALL SHARDS CONCURRENTLY
        const maxConcurrent = 14; // Go backend handles rate limits, we can send all 14 at once now
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
                  updateFile(fileId, { uploaded: globalCompletedShards })
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

      updateFile(fileId, { status: "complete" })
      // Call complete callback via window to avoid closure stale state
      window.dispatchEvent(new CustomEvent('aether-upload-complete', { detail: { volumeId: vId } }))
      toast.success(`${file.name} encrypted and uploaded`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed"
      
      if (inodeId) {
        api(`/api/inodes/${inodeId}`, { method: "DELETE" }).catch(err => console.error("Cleanup failed:", err))
      }

      updateFile(fileId, { status: msg === "cancelled" ? "cancelled" : "error" })
      if (msg !== "cancelled") toast.error(msg)
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!kdfSalt) {
        toast.error("Volume has no KDF salt set")
        return
      }

      const validFiles: File[] = []
      for (const f of acceptedFiles) {
        const isVideo = f.type.startsWith("video/")
        const maxSize = isVideo ? (1024 * 1024 * 1024) : (100 * 1024 * 1024) 
        if (f.size > maxSize) {
          toast.error(`File ${f.name} exceeds the ${isVideo ? "1GB" : "100MB"} limit.`)
        } else {
          validFiles.push(f)
        }
      }

      if (validFiles.length === 0) return;

      let pass = ""
      try {
        pass = await requestPassphrase("Upload Files", `Enter passphrase for volume to encrypt ${validFiles.length} file(s).`)
      } catch (err) {
        return 
      }

      const { masterKey } = await derive_master_key(pass, fromB64(kdfSalt))
      pass = ""

      const newFiles = validFiles.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        total: 1, 
        uploaded: 0,
        status: "queued" as const,
        abort: new AbortController(),
        volumeId: volumeId
      }))

      addFiles(newFiles)
      
      for (let i = 0; i < validFiles.length; i++) {
        const fileData = newFiles[i]
        // DO NOT await here! Let them run in the background unattached to React's lifecycle!
        processFile(validFiles[i], fileData.id, fileData.abort, masterKey, volumeId)
      }
    },
    [volumeId, kdfSalt, requestPassphrase, addFiles] // no dependency on processFile to avoid stale closures
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
          {isDragActive ? "Drop files to encrypt" : "Drop files or click to browse (Global)"}
        </p>
        <p className="text-xs text-muted-foreground">
          1 MB chunks. Encrypted client-side with AES-256-GCM.
        </p>
      </div>

      {volumeFiles.length > 0 && (
        <ul className="flex flex-col gap-2">
          {volumeFiles.map((f) => (
            <li key={f.id} className="flex flex-col gap-1 rounded-md border bg-card p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{f.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground capitalize">
                    {f.uploaded}/{f.total} {f.status}
                  </span>
                  {(f.status === "uploading" || f.status === "encrypting" || f.status === "queued") && (
                    <Button size="sm" variant="ghost" onClick={() => abortFile(f.id)}>
                      <X className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">Cancel</span>
                    </Button>
                  )}
                </div>
              </div>
              <Progress value={f.total > 0 ? (f.uploaded / f.total) * 100 : 0} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
