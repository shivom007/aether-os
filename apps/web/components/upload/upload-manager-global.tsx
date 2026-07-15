"use client"

import { useUploadStore } from "@/lib/store/upload-store"
import { X, Upload as UploadIcon, FileIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export function UploadManagerGlobal() {
  const { files, removeFile, abortFile } = useUploadStore()
  
  const queue = Object.values(files)
  
  if (queue.length === 0) return null

  const activeCount = queue.filter(t => t.status === "uploading" || t.status === "encrypting" || t.status === "queued").length

  const clearCompleted = () => {
    queue.forEach(q => {
      if (q.status === "complete" || q.status === "cancelled" || q.status === "error") {
        removeFile(q.id)
      }
    })
  }

  return (
    <div className="w-80 rounded-lg border bg-card shadow-lg flex flex-col overflow-hidden max-h-96">
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b">
        <span className="text-sm font-medium flex items-center gap-2">
          <UploadIcon className="h-4 w-4" />
          Uploads ({activeCount} active)
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCompleted}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {queue.map((task) => (
          <li key={task.id} className="flex flex-col gap-1 p-2 rounded border bg-background text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium flex items-center gap-1.5">
                <FileIcon className="h-3 w-3 text-muted-foreground" />
                {task.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {(task.status === "uploading" || task.status === "encrypting" || task.status === "queued") && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => abortFile(task.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {(task.status === "complete" || task.status === "error" || task.status === "cancelled") && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeFile(task.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground capitalize">
              <span>{task.status}</span>
              {(task.status === "uploading" || task.status === "encrypting") && 
                <span>{task.total > 0 ? Math.round((task.uploaded / task.total) * 100) : 0}%</span>
              }
            </div>
            {(task.status === "uploading" || task.status === "encrypting" || task.status === "queued") && (
              <Progress value={task.total > 0 ? (task.uploaded / task.total) * 100 : 0} className="h-1" />
            )}
            {task.status === "error" && (
              <p className="text-[10px] text-destructive leading-tight">Upload failed</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
