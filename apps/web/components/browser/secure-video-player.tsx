"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, LoaderCircle, VolumeX } from "lucide-react"
import { api } from "@/lib/api"
import type { Inode, MediaMetadata } from "@/lib/types"
import {
  assessMediaCompatibility,
  type MediaCompatibility,
} from "@/lib/media/compatibility"
import { probeStreamMedia } from "@/lib/media/stream-probe"
import { Button } from "@/components/ui/button"
import { StreamingEngine } from "@/components/browser/streaming-engine"

interface SecureVideoPlayerProps {
  inode: Inode
  volumeId: string
  masterKey: CryptoKey
  engine: "v1" | "v2"
  kdfSalt: string | null
  onMetadata?: (metadata: MediaMetadata) => void
}

export function SecureVideoPlayer({
  inode,
  volumeId,
  masterKey,
  engine,
  kdfSalt,
  onMetadata,
}: SecureVideoPlayerProps) {
  const [engineReady, setEngineReady] = useState(false)
  const [metadata, setMetadata] = useState<MediaMetadata | null>(
    inode.media_metadata || null,
  )
  const [isProbing, setIsProbing] = useState(!inode.media_metadata)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [allowVideoOnly, setAllowVideoOnly] = useState(false)
  const [forcePlayback, setForcePlayback] = useState(false)
  const handleEngineReady = useCallback(() => setEngineReady(true), [])

  useEffect(() => {
    if (!engineReady || metadata) return

    const abort = new AbortController()
    const streamUrl = `/stream/${inode.id}`

    probeStreamMedia(streamUrl, inode.size_bytes, abort.signal)
      .then(async (probed) => {
        if (!probed || abort.signal.aborted) {
          throw new Error("No media tracks were found")
        }
        setMetadata(probed)
        setProbeError(null)
        onMetadata?.(probed)

        try {
          await api(`/api/inodes/${inode.id}`, {
            method: "PATCH",
            body: JSON.stringify({ media_metadata: probed }),
            signal: abort.signal,
          })
        } catch (error) {
          if (!abort.signal.aborted) {
            console.warn("[Media] Failed to persist probed metadata:", error)
          }
        }
      })
      .catch((error) => {
        if (abort.signal.aborted) return
        console.error("[Media] Stream probe failed:", error)
        setProbeError(error instanceof Error ? error.message : "Media probe failed")
      })
      .finally(() => {
        if (!abort.signal.aborted) setIsProbing(false)
      })

    return () => abort.abort()
  }, [engineReady, inode.id, inode.size_bytes, metadata, onMetadata])

  const compatibility = useMemo(
    () => metadata
      ? assessMediaCompatibility(metadata, inode.mime_type)
      : null,
    [inode.mime_type, metadata],
  )

  const shouldPlay = canStartPlayback(
    compatibility,
    allowVideoOnly,
    forcePlayback,
    probeError,
  )

  return (
    <div className="relative flex min-h-[360px] w-full items-center justify-center bg-black">
      <StreamingEngine
        volumeId={volumeId}
        masterKey={masterKey}
        engine={engine}
        kdfSalt={kdfSalt}
        onReady={handleEngineReady}
      />

      {isProbing && !probeError ? (
        <div className="flex flex-col items-center gap-3 text-zinc-300">
          <LoaderCircle className="size-6 animate-spin" aria-hidden />
          <p className="text-sm">Inspecting media tracks...</p>
        </div>
      ) : compatibility?.status === "unsupported-audio" && !allowVideoOnly ? (
        <UnsupportedAudioState
          compatibility={compatibility}
          onPlayVideoOnly={() => setAllowVideoOnly(true)}
        />
      ) : compatibility?.status === "unsupported-video" ? (
        <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-zinc-200">
          <AlertTriangle className="size-7 text-amber-400" aria-hidden />
          <h3 className="text-base font-semibold">Video codec not supported</h3>
          <p className="text-sm text-zinc-400">
            {compatibility.videoTrack?.codec || "This video format"} cannot be decoded by this browser.
          </p>
        </div>
      ) : shouldPlay ? (
        <>
          <video
            controls
            autoPlay
            muted={allowVideoOnly}
            preload="metadata"
            src={`/stream/${inode.id}`}
            className="max-h-[80vh] h-auto w-full object-contain"
            onError={(event) => {
              const error = event.currentTarget.error
              console.error("[Media] Video element error:", {
                code: error?.code,
                message: error?.message,
                inodeId: inode.id,
                mimeType: inode.mime_type,
                metadata,
              })
            }}
          />
          {compatibility?.status === "video-only" && (
            <div className="pointer-events-none absolute bottom-12 left-3 rounded bg-black/75 px-2 py-1 text-xs text-zinc-200">
              No audio track
            </div>
          )}
          {allowVideoOnly && (
            <div className="pointer-events-none absolute bottom-12 left-3 rounded bg-black/75 px-2 py-1 text-xs text-zinc-200">
              Playing without audio
            </div>
          )}
        </>
      ) : (
        <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-zinc-300">
          <AlertTriangle className="size-7 text-amber-400" aria-hidden />
          <h3 className="text-base font-semibold">Media inspection failed</h3>
          <p className="text-sm text-zinc-400">{probeError}</p>
          <Button variant="secondary" onClick={() => setForcePlayback(true)}>
            Try playback
          </Button>
        </div>
      )}
    </div>
  )
}

function UnsupportedAudioState({
  compatibility,
  onPlayVideoOnly,
}: {
  compatibility: MediaCompatibility
  onPlayVideoOnly: () => void
}) {
  const track = compatibility.audioTrack
  const detail = [
    track?.codec,
    track?.channels ? `${track.channels} channels` : null,
  ].filter(Boolean).join(" - ")

  return (
    <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center text-zinc-200">
      <VolumeX className="size-8 text-amber-400" aria-hidden />
      <h3 className="text-base font-semibold">Audio codec not supported</h3>
      <p className="text-sm text-zinc-400">
        {detail || "The audio track"} cannot be decoded by this browser. The original file remains available for download.
      </p>
      <Button variant="secondary" onClick={onPlayVideoOnly}>
        Play video only
      </Button>
    </div>
  )
}

function canStartPlayback(
  compatibility: MediaCompatibility | null,
  allowVideoOnly: boolean,
  forcePlayback: boolean,
  probeError: string | null,
): boolean {
  if (allowVideoOnly || forcePlayback) return true
  if (probeError) return false
  if (!compatibility) return false
  return compatibility.status === "supported"
    || compatibility.status === "video-only"
    || compatibility.status === "unknown"
}
