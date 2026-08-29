"use client"

import { probeMediaSource } from "@/lib/media/probe"

export async function probeStreamMedia(
  url: string,
  fileSize: number,
  signal?: AbortSignal,
) {
  return probeMediaSource(fileSize, (size, offset) =>
    readHttpRange(url, fileSize, size, offset, signal),
  )
}

async function readHttpRange(
  url: string,
  fileSize: number,
  requestedSize: number,
  offset: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const remainingInFile = Math.max(0, fileSize - offset)
  let remaining = Math.min(requestedSize, remainingInFile)
  if (remaining === 0) return new Uint8Array()

  const chunks: Uint8Array[] = []
  let cursor = offset
  let total = 0

  while (remaining > 0) {
    const response = await fetch(url, {
      headers: {
        Range: `bytes=${cursor}-${cursor + remaining - 1}`,
      },
      signal,
    })
    if (!response.ok && response.status !== 206) {
      throw new Error(`Media probe range request failed with ${response.status}`)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.length === 0) {
      throw new Error("Media probe received an empty range")
    }

    chunks.push(bytes)
    total += bytes.length
    cursor += bytes.length
    remaining -= bytes.length
  }

  const result = new Uint8Array(total)
  let writeOffset = 0
  for (const chunk of chunks) {
    result.set(chunk, writeOffset)
    writeOffset += chunk.length
  }
  return result
}
