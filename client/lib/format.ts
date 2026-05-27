export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / Math.pow(1024, i)
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}

export function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const now = Date.now()
  const s = Math.round((now - t) / 1000)
  if (s < 5) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

export function mimeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase()
  if (!ext) return null
  const map: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    zip: "application/zip",
    tar: "application/x-tar",
    gz: "application/gzip",
    js: "text/javascript",
    ts: "text/typescript",
    html: "text/html",
    css: "text/css",
  }
  return map[ext] ?? "application/octet-stream"
}

/** Alias — matches the naming callers reach for. */
export const relativeTime = formatRelative

export function truncId(id: string, head = 8, tail = 0): string {
  if (!id) return ""
  if (id.length <= head + tail + 1) return id
  return tail > 0 ? `${id.slice(0, head)}…${id.slice(-tail)}` : `${id.slice(0, head)}…`
}
