import { describe, expect, it } from "vitest"
import type { MediaMetadata } from "@aether/contracts"
import { assessMediaCompatibility } from "./compatibility"

const eac3Metadata: MediaMetadata = {
  schema_version: 1,
  container: "Matroska",
  duration_seconds: 1555,
  tracks: [
    {
      kind: "video",
      codec: "AVC",
      codec_id: "V_MPEG4/ISO/AVC",
      codec_token: "avc1",
    },
    {
      kind: "audio",
      codec: "E-AC-3",
      codec_id: "A_EAC3",
      codec_token: "ec-3",
      channels: 6,
    },
  ],
}

const mp4Metadata: MediaMetadata = {
  schema_version: 1,
  container: "MPEG-4",
  tracks: [
    {
      kind: "video",
      codec: "AVC",
      codec_token: "avc1.640028",
    },
    {
      kind: "audio",
      codec: "AAC",
      codec_token: "mp4a.40.2",
    },
  ],
}

describe("assessMediaCompatibility", () => {
  it("classifies E-AC-3 as unsupported audio when video alone is supported", () => {
    const canPlay = (type: string): CanPlayTypeResult =>
      type.includes("ec-3") ? "" : "probably"

    const result = assessMediaCompatibility(
      eac3Metadata,
      "video/matroska",
      canPlay,
    )

    expect(result.status).toBe("unsupported-audio")
    expect(result.audioTrack?.codec).toBe("E-AC-3")
    expect(result.videoSupport).toBe("probably")
    expect(result.combinedSupport).toBe("")
  })

  it("accepts the same file when the browser exposes E-AC-3 support", () => {
    const result = assessMediaCompatibility(
      eac3Metadata,
      "video/matroska",
      () => "probably",
    )

    expect(result.status).toBe("supported")
  })

  it("identifies files without an audio track", () => {
    const metadata: MediaMetadata = {
      ...eac3Metadata,
      tracks: [eac3Metadata.tracks[0]],
    }

    const result = assessMediaCompatibility(
      metadata,
      "video/matroska",
      () => "probably",
    )

    expect(result.status).toBe("video-only")
    expect(result.audioTrack).toBeNull()
  })

  it("reports an unsupported video codec before evaluating audio", () => {
    const result = assessMediaCompatibility(
      {
        ...eac3Metadata,
        tracks: [
          { ...eac3Metadata.tracks[0], codec_token: "unsupported-video-codec" },
          eac3Metadata.tracks[1],
        ],
      },
      "video/matroska",
      (type) => type.includes("unsupported-video-codec") ? "" : "probably",
    )

    expect(result.status).toBe("unsupported-video")
  })

  it("falls back to the container when a known video codec is rejected", () => {
    const probes: string[] = []
    const result = assessMediaCompatibility(
      { ...mp4Metadata, tracks: [mp4Metadata.tracks[0]] },
      "video/mp4",
      (type) => {
        probes.push(type)
        return type === "video/mp4" ? "maybe" : ""
      },
    )

    expect(result.status).toBe("video-only")
    expect(result.videoSupport).toBe("maybe")
    expect(probes).toEqual([
      'video/mp4; codecs="avc1.640028"',
      "video/mp4",
    ])
  })

  it("does not use the container fallback for an unknown video codec", () => {
    const probes: string[] = []
    const result = assessMediaCompatibility(
      {
        ...mp4Metadata,
        tracks: [{ ...mp4Metadata.tracks[0], codec_token: "x-custom-video" }],
      },
      "video/mp4",
      (type) => {
        probes.push(type)
        return type === "video/mp4" ? "maybe" : ""
      },
    )

    expect(result.status).toBe("unsupported-video")
    expect(result.videoSupport).toBe("")
    expect(probes).toEqual(['video/mp4; codecs="x-custom-video"'])
  })

  it("falls back from a known audio codec to a video-only probe", () => {
    const result = assessMediaCompatibility(
      mp4Metadata,
      "video/mp4",
      (type) => (type.includes("mp4a.40.2") ? "" : "probably"),
    )

    expect(result.status).toBe("supported")
    expect(result.combinedSupport).toBe("probably")
  })
})
