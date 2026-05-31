"use client"

import { useEffect, useRef } from "react"
import { api } from "@/lib/api"
import { derive_chunk_key, decrypt_chunk } from "@/lib/crypto/core"
import { reconstructShards, DATA_SHARDS, TOTAL_SHARDS, fetchMinimumShards } from "@/lib/erasure"
import type { Inode, PhysicalChunk } from "@/lib/types"

interface StreamingEngineProps {
  volumeId: string
  masterKey: CryptoKey // unextractable WebCrypto key
  engine?: "v1" | "v2"
  kdfSalt?: string | null
}

export const streamingMetaCache = new Map<string, { inode: Inode; chunks: PhysicalChunk[] }>()
export const prefetchShardCache = new Map<string, Promise<Uint8Array>>()

export function StreamingEngine({ volumeId, masterKey, engine = "v1", kdfSalt }: StreamingEngineProps) {
  const isRegistered = useRef(false)

  // SW is registered globally by file-list.tsx

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const chunkPlaintextCache = new Map<string, Promise<Uint8Array>>()

    // Helper to fetch and decrypt a chunk
    const getDecryptedChunk = async (inodeId: string, chunkIndex: number): Promise<Uint8Array> => {
      const cacheKey = `${inodeId}_${chunkIndex}`
      if (chunkPlaintextCache.has(cacheKey)) {
        return chunkPlaintextCache.get(cacheKey)!
      }

      const promise = (async () => {
        // 1. Get or fetch metadata
        if (!streamingMetaCache.has(inodeId)) {
          const data = await api<{ inode: Inode; chunks: PhysicalChunk[] }>(`/api/inodes/${inodeId}`)
          if (!data.inode || data.chunks.length === 0) throw new Error("File not found or has no chunks")
          streamingMetaCache.set(inodeId, { inode: data.inode, chunks: data.chunks })
        }
        const { inode, chunks } = streamingMetaCache.get(inodeId)!

        // 3. Find target shards
        const targetShards = chunks.filter(c => c.chunk_index === chunkIndex)
        if (targetShards.length === 0) throw new Error(`Chunk ${chunkIndex} missing from DB`)

        // 4. Fetch exactly 10 shards intelligently
        const fetchedShards = await fetchMinimumShards(targetShards, async (shardId, signal) => {
          if (prefetchShardCache.has(shardId)) {
            return await prefetchShardCache.get(shardId)!
          }
          const res = await fetch(`/api/shards/${shardId}`, { signal })
          if (!res.ok) throw new Error(`Failed to fetch shard ${shardId}`)
          const buffer = await res.arrayBuffer()
          return new Uint8Array(buffer)
        })

        // 5. Reconstruct
        const CHUNK_SIZE = 5 * 1024 * 1024
        const isLastChunk = chunkIndex === Math.ceil(inode.size_bytes / CHUNK_SIZE) - 1
        let unencryptedSize = CHUNK_SIZE
        if (isLastChunk && inode.size_bytes % CHUNK_SIZE !== 0) {
          unencryptedSize = inode.size_bytes % CHUNK_SIZE
        }
        let originalSize = unencryptedSize + 16 // GCM tag
        const isV2 = engine === "v2"
        if (!isV2) originalSize += 12 // IV

        const reconstructed = await reconstructShards(fetchedShards, originalSize)

        // 6. Decrypt
        if (isV2) {
          if (!kdfSalt) throw new Error("Missing KDF salt for V2 engine")
          const { derive_chunk_key_v2, decrypt_chunk_v2, fromB64 } = await import("@/lib/crypto/core-v2")
          
          const saltBytes = fromB64(kdfSalt)
          const totalChunks = Math.ceil(inode.size_bytes / CHUNK_SIZE)
          const { chunkKey, nonce } = await derive_chunk_key_v2(masterKey, saltBytes, volumeId, chunkIndex)
          
          const aadString = `aether:v2:${volumeId}:${chunkIndex}:${totalChunks}`
          const aad = new TextEncoder().encode(aadString)
          
          return await decrypt_chunk_v2(reconstructed, chunkKey, nonce, aad)
        } else {
          const iv = reconstructed.slice(0, 12)
          const ciphertext = reconstructed.slice(12)
          
          const chunkKey = await derive_chunk_key(masterKey, volumeId, chunkIndex)
          return await decrypt_chunk(ciphertext, iv, chunkKey)
        }
      })()

      chunkPlaintextCache.set(cacheKey, promise)
      return promise
    }

    // Handle messages from SW
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === "FETCH_CHUNK") {
        const { id, inodeId, rangeHeader } = event.data
        try {
          // Get or fetch metadata
          if (!streamingMetaCache.has(inodeId)) {
            const data = await api<{ inode: Inode; chunks: PhysicalChunk[] }>(`/api/inodes/${inodeId}`)
            if (!data.inode) throw new Error("Metadata fetch failed")
            
            streamingMetaCache.set(inodeId, { inode: data.inode, chunks: data.chunks })
          }

          const { inode, chunks } = streamingMetaCache.get(inodeId)!

          const CHUNK_SIZE = 5 * 1024 * 1024
          let reqStartByte = 0
          let reqEndByte: number | undefined
          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
            if (match) {
              reqStartByte = parseInt(match[1], 10)
              if (match[2]) reqEndByte = parseInt(match[2], 10)
            }
          }

          const chunkIndex = Math.floor(reqStartByte / CHUNK_SIZE)
          console.log(`[Streaming] Requested startByte: ${reqStartByte}. Fetching chunk: ${chunkIndex}`)

          const targetShards = chunks.filter((c: any) => c.chunk_index === chunkIndex)
          if (targetShards.length === 0) throw new Error(`Chunk ${chunkIndex} missing from DB`)

          // 5. Decrypt current chunk (will use cache if available)
          const plaintext = await getDecryptedChunk(inodeId, chunkIndex)

          // 6. Calculate exact byte range to return
          const chunkStartByte = chunkIndex * CHUNK_SIZE
          const offsetInsideChunk = reqStartByte - chunkStartByte
          
          let sliceEnd = plaintext.length
          if (reqEndByte !== undefined && reqEndByte !== null) {
            sliceEnd = Math.min(reqEndByte - chunkStartByte + 1, plaintext.length)
          }
          
          const sliceToReturn = plaintext.slice(offsetInsideChunk, sliceEnd)
          const actualEndByte = chunkStartByte + offsetInsideChunk + sliceToReturn.length - 1

          // 7. Send success response to SW
          const sw = (event.source as ServiceWorker) || navigator.serviceWorker.controller
          if (sw) {
            sw.postMessage({
              type: "CHUNK_RESPONSE",
              id,
              buffer: sliceToReturn.buffer,
              status: 206,
              headers: {
                "Content-Type": inode.mime_type || "application/octet-stream",
                "Content-Range": `bytes ${reqStartByte}-${actualEndByte}/${inode.size_bytes}`,
                "Accept-Ranges": "bytes",
                "Content-Length": String(sliceToReturn.length)
              }
            }, [sliceToReturn.buffer])
          } else {
             console.error("[Streaming] No service worker to respond to")
          }

          // PREFETCH MULTIPLE CHUNKS AHEAD FOR SEAMLESS PLAYBACK
          const totalChunks = Math.ceil(inode.size_bytes / CHUNK_SIZE)
          const PREFETCH_WINDOW = 3
          
          const prefetchNextChunks = async () => {
            for (let i = 1; i <= PREFETCH_WINDOW; i++) {
              const nextIndex = chunkIndex + i
              if (nextIndex >= totalChunks) break
              try {
                await getDecryptedChunk(inodeId, nextIndex)
              } catch (err) {
                console.error(`[Streaming] Prefetch failed for chunk ${nextIndex}:`, err)
                break // Stop prefetching further if one fails to avoid cascading errors
              }
            }
          }
          
          prefetchNextChunks()

        } catch (error) {
          console.error("[Streaming] Decryption failed:", error)
          const sw = (event.source as ServiceWorker) || navigator.serviceWorker.controller
          if (sw) {
            sw.postMessage({
              type: "CHUNK_RESPONSE",
              id,
              error: error instanceof Error ? error.message : "Stream error"
            })
          }
        }
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage)
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage)
  }, [volumeId, masterKey, engine, kdfSalt])

  return null // Headless component
}
