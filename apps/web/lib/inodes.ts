export function toGoID(id: string | null | undefined): string | null {
  if (!id) return null
  return id.startsWith("folder-") ? id.slice("folder-".length) : id
}

export function toGoNumericID(id: string | null | undefined): number | null {
  const goID = toGoID(id)
  if (!goID) return null

  const parsed = Number.parseInt(goID, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function toFolderInodeID(id: number | string): string {
  return `folder-${id}`
}
