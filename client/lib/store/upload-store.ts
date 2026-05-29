import { create } from 'zustand'

export interface FileProgress {
  id: string
  name: string
  total: number
  uploaded: number
  status: "queued" | "encrypting" | "uploading" | "complete" | "error" | "cancelled"
  abort: AbortController
  inodeId?: string
  volumeId: string
}

interface UploadStore {
  files: Record<string, FileProgress>
  addFiles: (newFiles: FileProgress[]) => void
  updateFile: (id: string, updates: Partial<FileProgress>) => void
  removeFile: (id: string) => void
  abortFile: (id: string) => void
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  files: {},
  
  addFiles: (newFiles) => set((state) => {
    const next = { ...state.files }
    for (const f of newFiles) {
      next[f.id] = f
    }
    return { files: next }
  }),
  
  updateFile: (id, updates) => set((state) => {
    if (!state.files[id]) return state
    return {
      files: {
        ...state.files,
        [id]: { ...state.files[id], ...updates }
      }
    }
  }),
  
  removeFile: (id) => set((state) => {
    const next = { ...state.files }
    delete next[id]
    return { files: next }
  }),
  
  abortFile: (id) => {
    const file = get().files[id]
    if (file && (file.status === 'uploading' || file.status === 'encrypting' || file.status === 'queued')) {
      file.abort.abort()
      get().updateFile(id, { status: 'cancelled' })
    }
  }
}))
