import { derive_chunk_key, encrypt_chunk, toB64 } from "@/lib/crypto/core"

const MAX_THUMBNAIL_SIZE = 200

export async function generateEncryptedThumbnail(
  file: File,
  masterKey: CryptoKey,
  volumeId: string
): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return null
  }

  try {
    // 1. Generate low-res jpeg via Canvas
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(MAX_THUMBNAIL_SIZE / bitmap.width, MAX_THUMBNAIL_SIZE / bitmap.height)
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    ctx.drawImage(bitmap, 0, 0, width, height)
    
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    })
    
    if (!blob) return null
    const buffer = new Uint8Array(await blob.arrayBuffer())

    // 2. Encrypt it (using chunk index 999999 as standard metadata key)
    const thumbnailKey = await derive_chunk_key(masterKey, volumeId, 999999)
    const { iv, ciphertext } = await encrypt_chunk(buffer, thumbnailKey)

    // 3. Serialize to base64
    return `${toB64(iv)}:${toB64(ciphertext)}`
  } catch (err) {
    console.warn("Failed to generate thumbnail:", err)
    return null
  }
}
