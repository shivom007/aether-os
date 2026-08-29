import { z } from "zod"
import type { MediaMetadata } from "@aether/contracts"

export const MEDIA_METADATA_MAX_BYTES = 16 * 1024

export const MediaTrackMetadataSchema = z.object({
  kind: z.enum(["video", "audio", "text", "image", "other"]),
  codec: z.string().min(1).max(128),
  codec_id: z.string().max(128).optional(),
  codec_token: z.string().max(128).optional(),
  profile: z.string().max(128).optional(),
  language: z.string().max(32).optional(),
  channels: z.number().int().min(0).max(64).optional(),
  channel_layout: z.string().max(256).optional(),
  sample_rate: z.number().min(0).max(768000).optional(),
  width: z.number().int().min(0).max(32768).optional(),
  height: z.number().int().min(0).max(32768).optional(),
  frame_rate: z.number().min(0).max(1000).optional(),
})

export const MediaMetadataSchema = z.object({
  schema_version: z.literal(1),
  container: z.string().max(128).nullable(),
  duration_seconds: z.number().min(0).max(31_536_000).optional(),
  tracks: z.array(MediaTrackMetadataSchema).max(64),
})

export function parseMediaMetadata(value: unknown): MediaMetadata | null {
  if (!value) return null

  let candidate = value
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value)
    } catch {
      return null
    }
  }

  const parsed = MediaMetadataSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function serializeMediaMetadata(metadata: MediaMetadata): string {
  const parsed = MediaMetadataSchema.parse(metadata)
  const serialized = JSON.stringify(parsed)
  if (new TextEncoder().encode(serialized).byteLength > MEDIA_METADATA_MAX_BYTES) {
    throw new Error("Media metadata exceeds the storage limit")
  }
  return serialized
}
