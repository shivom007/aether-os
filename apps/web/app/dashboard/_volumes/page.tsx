"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Volume } from "@/lib/types"
import { VolumesTable } from "@/components/volumes/volumes-table"
import { CreateVolumeDialog } from "@/components/volumes/create-volume-dialog"
import { VolumeDrawer } from "@/components/volumes/volume-drawer"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function VolumesPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["volumes"],
    queryFn: () => api<Volume[]>("/api/volumes"),
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volumes</h1>
          <p className="text-sm text-muted-foreground">
            Zero-knowledge encrypted volumes. Root keys never leave your browser.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Create volume
        </Button>
      </header>

      <VolumesTable
        volumes={data ?? []}
        isLoading={isLoading}
        onSelect={(v) => setSelectedId(v.id)}
      />

      <CreateVolumeDialog open={createOpen} onOpenChange={setCreateOpen} />
      <VolumeDrawer
        volumeId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
