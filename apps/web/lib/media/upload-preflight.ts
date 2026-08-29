"use client"

import type { MediaMetadata } from "@aether/contracts"
import {
  assessMediaCompatibility,
  mediaMimeType,
  type MediaCompatibility,
} from "@/lib/media/compatibility"
import {
  hasVideoTrack,
  isLikelyVideoFile,
  probeMediaFile,
} from "@/lib/media/probe"

export interface PreparedUploadFile {
  file: File
  mediaMetadata: MediaMetadata | null
  compatibility: MediaCompatibility | null
  isVideo: boolean
  mimeType: string
}

export async function prepareUploadFiles(files: File[]): Promise<PreparedUploadFile[]> {
  const prepared: PreparedUploadFile[] = []

  for (const file of files) {
    let mediaMetadata: MediaMetadata | null = null
    try {
      mediaMetadata = await probeMediaFile(file)
    } catch (error) {
      console.warn(`[Media] Failed to inspect ${file.name}:`, error)
    }

    const isVideo = mediaMetadata
      ? hasVideoTrack(mediaMetadata)
      : isLikelyVideoFile(file)
    const mimeType = mediaMimeType(mediaMetadata, file.type || null)
    const compatibility = mediaMetadata && isVideo
      ? assessMediaCompatibility(mediaMetadata, mimeType)
      : null

    prepared.push({
      file,
      mediaMetadata,
      compatibility,
      isVideo,
      mimeType,
    })
  }

  return prepared
}

export function incompatibleAudioMessage(prepared: PreparedUploadFile): string | null {
  if (prepared.compatibility?.status !== "unsupported-audio") return null
  const codec = prepared.compatibility.audioTrack?.codec || "This"
  return `${prepared.file.name}: ${codec} audio is not supported by this browser. Upload will remain downloadable, but playback may be silent until converted.`
}
