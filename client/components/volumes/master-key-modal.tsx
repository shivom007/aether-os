"use client"

import { Copy, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function MasterKeyModal({
  keyB64,
  onClose,
}: {
  keyB64: string | null
  onClose: () => void
}) {
  if (!keyB64) return null
  async function copy() {
    await navigator.clipboard.writeText(keyB64!)
    toast.success("Master key copied")
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save your master key</DialogTitle>
          <DialogDescription>
            This key decrypts every file in this volume. We cannot recover it.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Zero-knowledge</AlertTitle>
          <AlertDescription>
            Aether-OS does not store this key. If you lose it, your data is permanently
            inaccessible.
          </AlertDescription>
        </Alert>

        <pre className="overflow-x-auto rounded-md border bg-muted p-3 font-mono text-xs leading-relaxed">
          {keyB64}
        </pre>

        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Copy
          </Button>
          <Button onClick={onClose}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
