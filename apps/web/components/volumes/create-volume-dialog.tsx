"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/lib/api"
import { derive_master_key, random_salt, bytesToBase64 } from "@/lib/crypto/core"
import { MasterKeyModal } from "./master-key-modal"

const NAME_RE = /^[a-zA-Z0-9_-]+$/

export function CreateVolumeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [masterKey, setMasterKey] = useState<string | null>(null)
  const qc = useQueryClient()

  const create = useMutation({
    mutationFn: async () => {
      if (!NAME_RE.test(name) || name.length < 1 || name.length > 255) {
        throw new Error("Name must be 1-255 chars, alphanumeric, _ or -")
      }
      if (passphrase.length < 8) throw new Error("Passphrase must be at least 8 chars")

      // Zero-knowledge: derive master key client-side, never sent to server.
      const salt = random_salt()
      const { fingerprint: fp } = await derive_master_key(passphrase, salt)
      const saltB64 = bytesToBase64(salt)

      const vol = await api<{ id: string }>("/api/volumes", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          kdf_salt: saltB64,
          master_key_fingerprint: fp,
        }),
      })
      
      return { vol }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["volumes"] })
      setName("")
      setDescription("")
      setPassphrase("")
      onOpenChange(false)
      toast.success("Volume created")
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create volume</DialogTitle>
            <DialogDescription>
              The master key is derived in your browser. We never see your passphrase.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="vol-name">Name</FieldLabel>
              <Input
                id="vol-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="prod-vol-01"
                autoComplete="off"
              />
              <FieldDescription>1-255 chars. Letters, digits, underscore, hyphen.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="vol-desc">Description</FieldLabel>
              <Textarea
                id="vol-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="vol-pass">Passphrase</FieldLabel>
              <Input
                id="vol-pass"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="new-password"
                data-lpignore="true"
              />
              <FieldDescription>
                Used to derive the volume master key via PBKDF2 + HKDF. Not stored.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Spinner className="mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MasterKeyModal
        keyB64={masterKey}
        onClose={() => setMasterKey(null)}
      />
    </>
  )
}
