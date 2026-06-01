export type ApiResult<T> = { success: true; data: T } | { success: false; error: string }

export type ProviderType = "s3" | "gcs" | "azure" | "b2" | "gdrive" | "dropbox"
export type InodeKind = "file" | "dir"
export type JobStatus = "queued" | "encoding" | "uploading" | "complete" | "failed"
export type WorkerStatus = "idle" | "processing" | "error" | "offline"
export type ProviderStatus = "healthy" | "unhealthy" | "unknown"

export interface User {
  id: string
  email: string
  salt_b64: string
  created_at: string
}

export interface Volume {
  id: string
  owner_id: string
  name: string
  description: string | null
  master_key_fingerprint: string
  kdf_salt: string | null
  created_at: string
  // Derived:
  logical_size_bytes: number
  inode_count: number
}

export interface Inode {
  id: string
  volume_id: string
  parent_id: string | null
  name: string
  kind: InodeKind
  size_bytes: number
  mime_type: string | null
  thumbnail_b64?: string | null
  materialized_path: string
  created_at: string
  updated_at: string
}

export interface ProviderCredential {
  id: string
  owner_id: string
  provider_type: ProviderType
  endpoint_url: string | null
  bucket: string
  region: string | null
  status: ProviderStatus
  last_checked_at: string | null
  created_at: string
}

export interface ProviderLatencyResult {
  latencyMs?: number
  status: ProviderStatus
}

export interface PhysicalChunk {
  id: string
  inode_id: string
  chunk_index: number
  shard_index: number
  provider_id: string | null
  provider_type?: ProviderType
  remote_object_id: string
  checksum_sha256: string
  size_bytes: number
  created_at: string
}

export interface Job {
  id: string
  inode_id: string
  chunk_index: number
  status: JobStatus
  attempts: number
  last_error: string | null
  worker_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Worker {
  id: string
  node_id: string
  status: WorkerStatus
  jobs_processed: number
  cpu_percent: number
  memory_percent: number
  started_at: string
  last_heartbeat: string
}

export interface AetherEvent<P = unknown> {
  id: number
  subject: string
  payload: P
  created_at: string
}

export interface SessionUser {
  sub: string
  email: string
}
