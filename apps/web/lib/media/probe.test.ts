import { describe, expect, it } from "vitest"
import type { MediaInfoResult } from "mediainfo.js"
import { isLikelyVideoFile, normalizeMediaInfo } from "./probe"

describe("normalizeMediaInfo", () => {
  it("maps E-AC-3 tracks to the browser ec-3 codec token", () => {
    const result = {
      media: {
        track: [
          {
            "@type": "General",
            Format: "Matroska",
            Duration: 1555.008,
          },
          {
            "@type": "Video",
            Format: "AVC",
            CodecID: "V_MPEG4/ISO/AVC",
          },
          {
            "@type": "Audio",
            Format: "E-AC-3",
            CodecID: "A_EAC3",
            Channels: 6,
          },
        ],
      },
    } as unknown as MediaInfoResult

    expect(normalizeMediaInfo(result)).toEqual({
      schema_version: 1,
      container: "Matroska",
      duration_seconds: 1555.008,
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
    })
  })
})

describe("isLikelyVideoFile", () => {
  it("recognizes MKV files when the browser leaves File.type empty", () => {
    expect(isLikelyVideoFile({ name: "movie.mkv", type: "" })).toBe(true)
  })
})
