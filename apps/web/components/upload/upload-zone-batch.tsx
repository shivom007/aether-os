"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload as UploadIcon, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import { derive_chunk_key_v2, derive_master_key_v2, encrypt_chunk_v2, fromB64 } from "@/lib/crypto/core-v2"
import { generateEncryptedThumbnail } from "@/lib/crypto/thumbnail"
import { usePassphrasePrompt } from "@/components/providers/passphrase-prompt-provider"
import { encodeShards } from "@/lib/erasure"
import type { ChunkAllocationResponse } from "@/lib/shards"
import type { Inode } from "@/lib/types"
import { useUploadStore } from "@/lib/store/upload-store"
import { globalUploadQueue } from "@/lib/utils/async-queue"

export interface UploadZoneProps {
  volumeId: string
  parentId?: string | null
  kdfSalt: string | null // base64
  onUploadComplete?: (inodeId: string) => void
}

export function UploadZoneBatch({ volumeId, parentId = null, kdfSalt, onUploadComplete }: UploadZoneProps) {
  const { requestPassphrase } = usePassphrasePrompt()
  const { files, addFiles, updateFile, abortFile } = useUploadStore()
  const volumeFiles = Object.values(files).filter(f => f.volumeId === volumeId)

  const processFile = async (
    file: File,
    fileId: string,
    abort: AbortController,
    masterKey: CryptoKey,
    saltB64: string
  ) => {
    updateFile(fileId, { status: "encrypting" })

    let inodeId: string | undefined;
    try {
      const fingerprintStr = `${volumeId}:${file.name}:${file.size}:${file.lastModified}`;
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintStr));
      const fingerprint = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      const thumbnail_b64 = await generateEncryptedThumbnail(file, masterKey, volumeId)
      
      const inode = await api<Inode & { completedChunks?: number[] }>("/api/inodes", {
        method: "POST",
          body: JSON.stringify({
            volume_id: volumeId,
            parent_id: parentId,
            name: file.name,
          kind: "file",
          size_bytes: file.size,
          mime_type: file.type,
          thumbnail: thumbnail_b64 || undefined,
          fingerprint: fingerprint,
        }),
        signal: abort.signal,
      })
      inodeId = inode.id
      updateFile(fileId, { status: "uploading", inodeId: inode.id })

      const isVideo = file.type.startsWith("video/")
      const dynamicChunkSize = isVideo ? (5 * 1024 * 1024) : Math.max(1, file.size)
      const totalChunks = Math.max(1, Math.ceil(file.size / dynamicChunkSize))
      
      let globalCompletedShards = 0;
      let totalShardsPerChunk = 0;
      
      updateFile(fileId, { uploaded: 0, total: totalChunks * 4 }) // Temporary guess for total
      
      for (let i = 0; i < totalChunks; i++) {
        if (abort.signal.aborted) throw new Error("cancelled")
        if (inode.completedChunks?.includes(i)) {
          // We will correct the globalCompletedShards once we know the shard math
          continue; // Skip this chunk, it's already uploaded!
        }

        const start = i * dynamicChunkSize
        const end = Math.min(start + dynamicChunkSize, file.size)
        const slice = new Uint8Array(await file.slice(start, end).arrayBuffer())
        // V2 Crypto Engine
        const saltBytes = fromB64(saltB64)
        const { chunkKey, nonce } = await derive_chunk_key_v2(masterKey, saltBytes, volumeId, i)
        
        const aadString = `aether:v2:${volumeId}:${i}:${totalChunks}`
        const aad = new TextEncoder().encode(aadString)
        
        const ciphertext = await encrypt_chunk_v2(slice, chunkKey, nonce, aad)

        // Memory Zeroing: Securely wipe the plaintext bytes from RAM
        slice.fill(0)

        // Since V2 doesn't prepend the IV, the body is just the ciphertext!
        const body = ciphertext

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

        const encoded = await encodeShards(body, allocation.dataShards, allocation.parityShards)

        const totalShards = allocation.allocations.length;
        
        if (totalShardsPerChunk === 0) {
            totalShardsPerChunk = totalShards;
            updateFile(fileId, { total: totalChunks * totalShardsPerChunk });
            if (inode.completedChunks && inode.completedChunks.length > 0) {
                globalCompletedShards = inode.completedChunks.length * totalShardsPerChunk;
                updateFile(fileId, { uploaded: globalCompletedShards });
            }
        }
        
        const uploadPromises = [];
        for (let idxShard = 0; idxShard < totalShards; idxShard++) {
          if (idxShard >= encoded.shards.length) continue;
          const shard = allocation.allocations[idxShard];
          const blob = new Blob([encoded.shards[idxShard] as any]);
          
          const uploadWithRetry = async (attempt = 1): Promise<void> => {
            const formData = new FormData();
            formData.append("shardId", String(shard.shardId));
            formData.append("file", blob, `shard_${shard.shardId}_${idxShard}`);
            
            try {
              const res = await fetch(`/api/jobs/shard`, {
                method: "POST",
                body: formData,
                signal: abort.signal,
              });

              if (!res.ok) {
                const errText = await res.text().catch(() => "Upload failed");
                // Retry on 500 errors (which Go throws on Provider rate limits)
                if (res.status >= 500 && attempt < 3) {
                  console.warn(`Shard ${idxShard} failed (attempt ${attempt}). Retrying...`);
                  await new Promise(r => setTimeout(r, 1500 * attempt));
                  return uploadWithRetry(attempt + 1);
                }
                throw new Error(`Shard ${idxShard} upload failed: ${errText}`);
              }
            } catch (err: any) {
              if (err.name !== 'AbortError' && attempt < 3) {
                console.warn(`Shard ${idxShard} network error (attempt ${attempt}). Retrying...`);
                await new Promise(r => setTimeout(r, 1500 * attempt));
                return uploadWithRetry(attempt + 1);
              }
              throw err;
            }
          };

          uploadPromises.push(uploadWithRetry());
        }

        await Promise.all(uploadPromises);

        globalCompletedShards += totalShards;
        updateFile(fileId, { uploaded: globalCompletedShards })
      }

      updateFile(fileId, { status: "complete" })
      window.dispatchEvent(new CustomEvent('aether-upload-complete', { detail: { volumeId } }))
      toast.success(`${file.name} encrypted and uploaded (${totalChunks} chunks)`)
      onUploadComplete?.(inode.id)
    } catch (e) {
      abort.abort();
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

      const { masterKey } = await derive_master_key_v2(pass, fromB64(kdfSalt))
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
        globalUploadQueue.add(() => 
          processFile(validFiles[i], fileData.id, fileData.abort, masterKey, kdfSalt)
        ).catch(console.error)
      }
    },
    [volumeId, parentId, kdfSalt, requestPassphrase, addFiles],
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
          {isDragActive ? "Drop files to encrypt" : "Drop files or click to browse (Batch)"}
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
