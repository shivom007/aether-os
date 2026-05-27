import { create } from "zustand"
import type { Inode } from "@/lib/types"

export interface DownloadTask {
  id: string
  inode: Inode
  volumeId: string
  masterKey: CryptoKey
  status: "queued" | "downloading" | "complete" | "error"
  progress: number
  error?: string
}

interface DownloadStore {
  queue: DownloadTask[]
  enqueue: (inode: Inode, volumeId: string, masterKey: CryptoKey) => void
  remove: (id: string) => void
  updateTask: (id: string, updates: Partial<DownloadTask>) => void
  clearCompleted: () => void
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  queue: [],
  enqueue: (inode, volumeId, masterKey) => {
    set((state) => {
      // Don't enqueue if already in queue and not complete/error
      if (state.queue.some((t) => t.inode.id === inode.id && (t.status === "queued" || t.status === "downloading"))) {
        return state
      }
      return {
        queue: [
          ...state.queue,
          {
            id: crypto.randomUUID(),
            inode,
            volumeId,
            masterKey,
            status: "queued",
            progress: 0,
          },
        ],
      }
    })
  },
  remove: (id) => {
    set((state) => ({ queue: state.queue.filter((t) => t.id !== id) }))
  },
  updateTask: (id, updates) => {
    set((state) => ({
      queue: state.queue.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  },
  clearCompleted: () => {
    set((state) => ({
      queue: state.queue.filter((t) => t.status !== "complete" && t.status !== "error"),
    }))
  },
}))
