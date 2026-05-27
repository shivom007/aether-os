"use client"

import { useEffect, useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { derive_chunk_key, derive_master_key, decrypt_chunk, fromB64 } from "@/lib/crypto/core"
import { api } from "@/lib/api"
import type { Volume } from "@/lib/types"

interface EncryptedThumbnailProps {
  volumeId: string
  thumbnailB64: string
  masterKey?: CryptoKey | null
  className?: string
}

const blobCache = new Map<string, string>()
const MAX_CACHE_SIZE = 200

function addToCache(key: string, url: string) {
  if (blobCache.size >= MAX_CACHE_SIZE) {
    const firstKey = blobCache.keys().next().value
    if (firstKey) {
      const oldUrl = blobCache.get(firstKey)
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      blobCache.delete(firstKey)
    }
  }
  blobCache.set(key, url)
}

export function EncryptedThumbnail({ volumeId, thumbnailB64, masterKey, className }: EncryptedThumbnailProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(() => blobCache.get(thumbnailB64) || null)

  useEffect(() => {
    if (blobUrl) return // We already have it from cache

    let active = true

    async function decrypt() {
      try {
        if (!masterKey) return // Can't decrypt without masterKey

        if (blobCache.has(thumbnailB64)) {
          if (active) setBlobUrl(blobCache.get(thumbnailB64)!)
          return
        }

        const thumbnailKey = await derive_chunk_key(masterKey, volumeId, 999999)

        let payload = thumbnailB64
        if (thumbnailB64.startsWith("http://") || thumbnailB64.startsWith("https://")) {
          // It's a presigned URL, fetch the encrypted blob content
          const res = await fetch(thumbnailB64)
          if (!res.ok) throw new Error("Failed to fetch thumbnail from S3")
          payload = await res.text()
        }

        const [ivB64, ctB64] = payload.split(":")
        if (!ivB64 || !ctB64) return

        const iv = fromB64(ivB64)
        const ct = fromB64(ctB64)

        const decryptedBytes = await decrypt_chunk(ct, iv, thumbnailKey)
        const blob = new Blob([decryptedBytes as any], { type: "image/jpeg" })
        const url = URL.createObjectURL(blob)
        
        addToCache(thumbnailB64, url)
        
        if (active) setBlobUrl(url)
      } catch (err) {
        console.warn("Failed to decrypt thumbnail", err)
      }
    }

    decrypt()

    return () => {
      active = false
      // Do not revoke the URL here so the cache persists across React component unmounts (like view mode toggle)
    }
  }, [volumeId, thumbnailB64, masterKey, blobUrl])

  if (!blobUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`}>
        <ImageIcon className="size-4" aria-hidden />
      </div>
    )
  }

  return <img src={blobUrl} alt="Thumbnail preview" className={`object-cover ${className}`} />
}
