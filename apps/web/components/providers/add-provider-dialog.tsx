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
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/lib/api"
import type { ProviderType } from "@/lib/types"

export function AddProviderDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [providerType, setProviderType] = useState<ProviderType>("s3")
  const [endpointUrl, setEndpointUrl] = useState("")
  const [bucket, setBucket] = useState("")
  const [region, setRegion] = useState("us-east-1")
  const [accessKey, setAccessKey] = useState("")
  const [secretKey, setSecretKey] = useState("")
  const [gcsJson, setGcsJson] = useState("")
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      let access_key = accessKey
      let secret_key = secretKey
      // GCS uses HMAC interop keys. We ask for a service-account JSON and
      // extract access_id/secret. For brevity, we accept interop creds inline.
      if (providerType === "gcs" && gcsJson.trim().length > 0) {
        try {
          const parsed = JSON.parse(gcsJson) as { access_id?: string; secret?: string }
          access_key = parsed.access_id || access_key
          secret_key = parsed.secret || secret_key
        } catch {
          throw new Error("GCS credentials JSON is invalid")
        }
      }
      if (!access_key || !secret_key) throw new Error("Access key and secret are required")
      if (!bucket) throw new Error("Bucket is required")

      await api("/api/providers", {
        method: "POST",
        body: JSON.stringify({
          provider_type: providerType,
          endpoint_url: endpointUrl || null,
          bucket,
          region: region || null,
          access_key,
          secret_key,
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["providers"] })
      toast.success("Provider added")
      setBucket("")
      setAccessKey("")
      setSecretKey("")
      setGcsJson("")
      setEndpointUrl("")
      onOpenChange(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add provider</DialogTitle>
          <DialogDescription>
            Access tokens are encrypted with the server wrapping key before being written.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="provider-type">Provider type</FieldLabel>
            <Select value={providerType} onValueChange={(v) => setProviderType(v as ProviderType)}>
              <SelectTrigger id="provider-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="s3">Amazon S3</SelectItem>
                <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                <SelectItem value="b2">Backblaze B2</SelectItem>
                <SelectItem value="azure">Azure Blob</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="bucket">Bucket</FieldLabel>
            <Input id="bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} autoComplete="off" />
          </Field>

          {providerType !== "gcs" && (
            <>
              <Field>
                <FieldLabel htmlFor="endpoint">Endpoint URL (optional)</FieldLabel>
                <Input
                  id="endpoint"
                  placeholder="https://s3.amazonaws.com or https://s3.us-west-002.backblazeb2.com"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>Leave blank for AWS S3 default endpoint.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="region">Region</FieldLabel>
                <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="access-key">Access key</FieldLabel>
                <Input
                  id="access-key"
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="secret-key">Secret key</FieldLabel>
                <Input
                  id="secret-key"
                  type="password"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            </>
          )}

          {providerType === "gcs" && (
            <Field>
              <FieldLabel htmlFor="gcs-creds">GCS interop credentials (JSON)</FieldLabel>
              <Textarea
                id="gcs-creds"
                rows={6}
                value={gcsJson}
                onChange={(e) => setGcsJson(e.target.value)}
                placeholder={'{ "access_id": "GOOG...", "secret": "..." }'}
                className="font-mono text-xs"
              />
              <FieldDescription>HMAC interop keys from the Cloud Console.</FieldDescription>
            </Field>
          )}

          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Spinner className="mr-2" />}
            Add provider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
