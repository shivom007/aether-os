"use client"

import type {
  MediaInfo,
  MediaInfoResult,
  Track,
} from "mediainfo.js"
import type {
  MediaMetadata,
  MediaTrackKind,
  MediaTrackMetadata,
} from "@aether/contracts"

const VIDEO_EXTENSIONS = new Set([
  "avi",
  "m4v",
  "mkv",
  "mov",
  "mp4",
  "mpeg",
  "mpg",
  "ogv",
  "ts",
  "webm",
])

let mediaInfoPromise: Promise<MediaInfo<"object">> | null = null
let probeQueue: Promise<void> = Promise.resolve()

async function getMediaInfo(): Promise<MediaInfo<"object">> {
  if (!mediaInfoPromise) {
    mediaInfoPromise = import("mediainfo.js").then(({ default: createMediaInfo }) =>
      createMediaInfo({
        chunkSize: 256 * 1024,
        format: "object",
        locateFile: () => "/MediaInfoModule.wasm",
      }),
    )
  }
  return mediaInfoPromise
}

function enqueueProbe<T>(task: () => Promise<T>): Promise<T> {
  const result = probeQueue.then(task, task)
  probeQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

export function isLikelyVideoFile(file: Pick<File, "name" | "type">): boolean {
  if (file.type.startsWith("video/")) return true
  const extension = file.name.split(".").pop()?.toLowerCase()
  return extension ? VIDEO_EXTENSIONS.has(extension) : false
}

export function hasVideoTrack(metadata: MediaMetadata | null): boolean {
  return metadata?.tracks.some((track) => track.kind === "video") ?? false
}

export async function probeMediaFile(file: File): Promise<MediaMetadata | null> {
  if (!isLikelyVideoFile(file) && !file.type.startsWith("audio/")) return null

  return enqueueProbe(async () => {
    const mediaInfo = await getMediaInfo()
    const result = await mediaInfo.analyzeData(
      () => file.size,
      async (size, offset) =>
        new Uint8Array(await file.slice(offset, offset + size).arrayBuffer()),
    )
    return normalizeMediaInfo(result)
  })
}

export async function probeMediaSource(
  size: number,
  readChunk: (size: number, offset: number) => Promise<Uint8Array>,
): Promise<MediaMetadata | null> {
  return enqueueProbe(async () => {
    const mediaInfo = await getMediaInfo()
    const result = await mediaInfo.analyzeData(() => size, readChunk)
    return normalizeMediaInfo(result)
  })
}

export function normalizeMediaInfo(result: MediaInfoResult): MediaMetadata | null {
  const tracks = result.media?.track
  if (!tracks?.length) return null

  const general = tracks.find((track) => track["@type"] === "General")
  const normalizedTracks = tracks
    .filter((track) => track["@type"] !== "General")
    .map(normalizeTrack)
    .filter((track): track is MediaTrackMetadata => track !== null)

  return {
    schema_version: 1,
    container: general?.Format || null,
    duration_seconds: finitePositive(general?.Duration),
    tracks: normalizedTracks,
  }
}

function normalizeTrack(track: Track): MediaTrackMetadata | null {
  const kind = normalizeTrackKind(track["@type"])
  if (!kind) return null

  const codec = track.Format || track.CodecID || "Unknown"
  const normalized: MediaTrackMetadata = {
    kind,
    codec,
  }

  assignString(normalized, "codec_id", track.CodecID)
  assignString(normalized, "codec_token", codecToken(kind, codec, track.CodecID))
  assignString(normalized, "profile", track.Format_Profile)
  if ("Language" in track) {
    assignString(normalized, "language", track.Language)
  }

  if (track["@type"] === "Audio") {
    assignNumber(normalized, "channels", track.Channels)
    assignString(normalized, "channel_layout", track.ChannelLayout)
    assignNumber(normalized, "sample_rate", track.SamplingRate)
  }

  if (track["@type"] === "Video") {
    assignNumber(normalized, "width", track.Width)
    assignNumber(normalized, "height", track.Height)
    assignNumber(normalized, "frame_rate", track.FrameRate)
  }

  return normalized
}

function normalizeTrackKind(type: Track["@type"]): MediaTrackKind | null {
  switch (type) {
    case "Video":
      return "video"
    case "Audio":
      return "audio"
    case "Text":
      return "text"
    case "Image":
      return "image"
    case "Menu":
    case "Other":
      return "other"
    default:
      return null
  }
}

function codecToken(kind: MediaTrackKind, format: string, codecID?: string): string | undefined {
  const value = `${format} ${codecID || ""}`.toLowerCase()

  if (kind === "video") {
    if (value.includes("avc") || value.includes("h.264")) return "avc1"
    if (value.includes("hevc") || value.includes("h.265")) return "hvc1"
    if (value.includes("av1")) return "av01"
    if (value.includes("vp9")) return "vp09"
    if (value.includes("vp8")) return "vp8"
    if (value.includes("theora")) return "theora"
  }

  if (kind === "audio") {
    if (value.includes("e-ac-3") || value.includes("eac3")) return "ec-3"
    if (value.includes("ac-3") || value.includes("ac3")) return "ac-3"
    if (value.includes("aac")) return "mp4a.40.2"
    if (value.includes("opus")) return "opus"
    if (value.includes("vorbis")) return "vorbis"
    if (value.includes("flac")) return "flac"
    if (value.includes("mpeg audio") || value.includes("mp3")) return "mp3"
    if (value.includes("dts")) return "dts"
  }

  return undefined
}

function assignString<K extends keyof MediaTrackMetadata>(
  target: MediaTrackMetadata,
  key: K,
  value: unknown,
) {
  if (typeof value === "string" && value.trim()) {
    Object.assign(target, { [key]: value.trim() })
  }
}

function assignNumber<K extends keyof MediaTrackMetadata>(
  target: MediaTrackMetadata,
  key: K,
  value: unknown,
) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    Object.assign(target, { [key]: value })
  }
}

function finitePositive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}
