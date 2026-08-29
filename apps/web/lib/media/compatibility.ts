"use client"

import type { MediaMetadata, MediaTrackMetadata } from "@aether/contracts"

export type MediaCompatibilityStatus =
  | "supported"
  | "unsupported-audio"
  | "unsupported-video"
  | "video-only"
  | "unknown"

export interface MediaCompatibility {
  status: MediaCompatibilityStatus
  mimeType: string
  videoTrack: MediaTrackMetadata | null
  audioTrack: MediaTrackMetadata | null
  videoSupport: CanPlayTypeResult
  combinedSupport: CanPlayTypeResult
}

type CanPlay = (type: string) => CanPlayTypeResult

export function assessMediaCompatibility(
  metadata: MediaMetadata | null,
  fallbackMimeType: string | null | undefined,
  canPlay?: CanPlay,
): MediaCompatibility {
  const mimeType = mediaMimeType(metadata, fallbackMimeType)
  const videoTrack = metadata?.tracks.find((track) => track.kind === "video") || null
  const audioTrack = metadata?.tracks.find((track) => track.kind === "audio") || null
  const probe = canPlay || browserCanPlayType

  if (!videoTrack) {
    return {
      status: "unknown",
      mimeType,
      videoTrack,
      audioTrack,
      videoSupport: "",
      combinedSupport: "",
    }
  }

  // Try with specific codec string first, then fall back to just the container
  // canPlayType often returns "" for short codec tokens (e.g. "vp09") even though
  // the browser fully supports the codec — it needs the full profile string like
  // "vp09.00.10.08". So we also try the bare container as a fallback.
  let videoSupport = videoTrack.codec_token
    ? probe(withCodecs(mimeType, [videoTrack.codec_token]))
    : probe(mimeType)

  if (!videoSupport && videoTrack.codec_token) {
    // Fallback: check if the container itself is playable
    videoSupport = probe(mimeType)
  }

  if (!videoSupport) {
    return {
      status: "unsupported-video",
      mimeType,
      videoTrack,
      audioTrack,
      videoSupport,
      combinedSupport: "",
    }
  }

  if (!audioTrack) {
    return {
      status: "video-only",
      mimeType,
      videoTrack,
      audioTrack,
      videoSupport,
      combinedSupport: videoSupport,
    }
  }

  if (!audioTrack.codec_token) {
    return {
      status: "unknown",
      mimeType,
      videoTrack,
      audioTrack,
      videoSupport,
      combinedSupport: "",
    }
  }

  let combinedSupport = probe(
    withCodecs(
      mimeType,
      [videoTrack.codec_token, audioTrack.codec_token].filter(
        (codec): codec is string => Boolean(codec),
      ),
    ),
  )

  // Fallback: if combined codec string fails, try just the container
  if (!combinedSupport) {
    combinedSupport = probe(mimeType)
  }

  return {
    status: combinedSupport ? "supported" : "unsupported-audio",
    mimeType,
    videoTrack,
    audioTrack,
    videoSupport,
    combinedSupport,
  }
}

export function mediaMimeType(
  metadata: MediaMetadata | null,
  fallbackMimeType: string | null | undefined,
): string {
  const container = metadata?.container?.toLowerCase() || ""
  if (container.includes("matroska")) return "video/matroska"
  if (container.includes("webm")) return "video/webm"
  if (container.includes("mpeg-4") || container.includes("quicktime")) return "video/mp4"
  if (container.includes("ogg")) return "video/ogg"
  return fallbackMimeType || "application/octet-stream"
}

function withCodecs(mimeType: string, codecs: string[]): string {
  return `${mimeType}; codecs="${codecs.join(", ")}"`
}

function browserCanPlayType(type: string): CanPlayTypeResult {
  if (typeof document === "undefined") return ""
  return document.createElement("video").canPlayType(type)
}
