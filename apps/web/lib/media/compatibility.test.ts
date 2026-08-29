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
      eac3Metadata,
      "video/matroska",
      (type) => type.includes("avc1") ? "" : "probably",
    )

    expect(result.status).toBe("unsupported-video")
  })
})
