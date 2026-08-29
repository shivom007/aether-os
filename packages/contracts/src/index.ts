export type ApiResult<T> = { success: true; data: T } | { success: false; error: string }
export type ISODateString = string

export type ProviderType = "s3" | "gcs" | "azure" | "b2" | "gdrive" | "dropbox"
export type InodeKind = "file" | "dir"
export type JobStatus = "queued" | "encoding" | "uploading" | "complete" | "failed"
export type WorkerStatus = "idle" | "processing" | "error" | "offline"
export type ProviderStatus = "healthy" | "unhealthy" | "unknown"

export interface SessionUser {
  sub: string
  email: string
}

export interface GoRegisterRequest {
  username: string
  authHash: string
}

export interface GoRegisterResponse {
  message: string
  userId: number
}

export interface GoLoginRequest {
  username: string
  authHash: string
}

export interface GoLoginResponse {
  token: string
  expiresAt: number
}

export interface GoVerifyResponse {
  userId: number
  username: string
}

export type GoRefreshResponse = GoLoginResponse

export interface GoLogoutResponse {
  message: string
}

export interface GoVolume {
  id: string
  userId: number
  name: string
  description: string
  masterKeyFingerprint: string
  kdfSalt: string
  createdAt: ISODateString
  updatedAt: ISODateString
}

export interface GoCreateVolumeRequest {
  id: string
  name: string
  description: string
  master_key_fingerprint: string
  kdf_salt: string
}

export interface GoUpdateVolumeRequest {
  name?: string
  description?: string
}

export interface GoDeleteVolumeResponse {
  deleted: string
}

export interface GoFolder {
  id: number
  userId: number
  volumeId: string
  parentId: number | null
  name: string
  createdAt: ISODateString
  updatedAt: ISODateString
}

export interface GoFile {
  id: number
  userId: number
  volumeId: string
  folderId: number | null
  name: string
  size: number
  mimeType: string
  thumbnail?: string
  fingerprint?: string
  mediaMetadata?: string
  createdAt: ISODateString
  updatedAt: ISODateString
  versions?: GoFileVersion[]
}

export interface GoFileVersion {
  id: number
  fileId: number
  version: number
  size: number
  createdAt: ISODateString
  chunks?: GoChunk[]
}

export interface GoChunk {
  id: number
  fileVersionId: number
  chunkIndex: number
  size: number
  dataShards: number
  parityShards: number
  shards?: GoShard[]
}

export interface GoShard {
  id: number
  chunkId: number
  shardIndex: number
  provider: string
  providerFileId: string
  status: string
  createdAt?: ISODateString
  updatedAt?: ISODateString
}

export interface GoListFilesResponse {
  folders: GoFolder[] | null
  files: GoFile[] | null
}

export interface GoCreateFolderRequest {
  name: string
  parentId: number | null
  volumeId: string
}

export type GoCreateFolderResponse = GoFolder

export interface GoCreateFileRequest {
  name: string
  folderId: number | null
  volumeId: string
  size: number
  mimeType: string
  thumbnail?: string
  fingerprint?: string
  mediaMetadata?: string
}

export interface GoCreateFileResponse {
  file: GoFile
  versionId: number
  completedChunks?: number[]
}

export interface GoMessageResponse {
  message: string
}

export interface GoProvider {
  id: number
  provider: string
  providerType: string
  endpointUrl: string
  bucket: string
  region: string
  status: string
  lastCheckedAt: ISODateString | null
  createdAt: ISODateString
}

export interface GoLinkProviderRequest {
  accessKey: string
  secretKey: string
  region: string
  bucket: string
  endpointUrl: string
  providerType: "s3" | "gcs" | "azure" | "b2"
}

export interface GoLinkProviderResponse {
  message: string
  id: number
}

export interface GoOAuthSessionRequest {
  provider: string
}

export interface GoOAuthSessionResponse {
  sessionId: string
}

export interface GoProviderHealthResponse {
  status: string
  latencyMs: number
}

export type GoProviderLatencyResponse = Record<string, GoProviderHealthResponse>

export interface GoAllocateShardRequest {
  fileVersionId: number
  chunkIndex: number
  chunkSize: number
}

export interface GoShardAllocation {
  shardId: number
  shardIndex: number
  provider: string
}

export interface GoChunkAllocation {
  dataShards: number
  parityShards: number
  allocations: GoShardAllocation[]
}

export interface GoAllocateShardResponse {
  allocation: GoChunkAllocation
}

export interface GoUploadShardResponse {
  message: string
  providerFileId: string
}

export interface WebUser {
  id: string
  email: string
  salt_b64: string
  created_at: ISODateString
}

export interface WebMeUser {
  sub: string
  email: string
  salt_b64: string
}

export interface WebVolume {
  id: string
  owner_id: string
  name: string
  description: string | null
  master_key_fingerprint: string
  kdf_salt: string | null
  created_at: ISODateString
  logical_size_bytes: number
  inode_count: number
}

export type MediaTrackKind = "video" | "audio" | "text" | "image" | "other"

export interface MediaTrackMetadata {
  kind: MediaTrackKind
  codec: string
  codec_id?: string
  codec_token?: string
  profile?: string
  language?: string
  channels?: number
  channel_layout?: string
  sample_rate?: number
  width?: number
  height?: number
  frame_rate?: number
}

export interface MediaMetadata {
  schema_version: 1
  container: string | null
  duration_seconds?: number
  tracks: MediaTrackMetadata[]
}

export interface WebCreateVolumeRequest {
  name: string
  description?: string | null
  kdf_salt: string
  master_key_fingerprint?: string
}

export interface WebInode {
  id: string
  volume_id: string
  parent_id: string | null
  name: string
  kind: InodeKind
  size_bytes: number
  mime_type: string | null
  media_metadata?: MediaMetadata | null
  thumbnail_b64?: string | null
  materialized_path: string
  created_at: ISODateString
  updated_at: ISODateString
}

export interface WebCreateInodeRequest {
  volume_id: string
  parent_id?: string | null
  name: string
  kind: InodeKind
  size_bytes?: number
  mime_type?: string | null
  media_metadata?: MediaMetadata | null
  thumbnail?: string
  fingerprint?: string
}

export type WebCreateFileInodeResponse = WebInode & {
  versionId: number
  completedChunks: number[]
}

export interface WebListInodesResponse {
  inodes: WebInode[]
  root_id: string
}

export interface WebInodeDetailsResponse {
  inode: WebInode
  chunks: WebPhysicalChunk[]
}

export interface WebProviderCredential {
  id: string
  owner_id: string
  provider_type: ProviderType
  endpoint_url: string | null
  bucket: string
  region: string | null
  status: ProviderStatus
  last_checked_at: ISODateString | null
  created_at: ISODateString
}

export interface WebCreateProviderRequest {
  provider_type: "s3" | "gcs" | "azure" | "b2"
  endpoint_url?: string | null
  bucket: string
  region?: string | null
  access_key: string
  secret_key: string
}

export interface WebProviderLatencyResult {
  latencyMs?: number
  status: ProviderStatus
}

export interface WebPhysicalChunk {
  id: string
  inode_id: string
  chunk_index: number
  shard_index: number
  data_shards: number
  parity_shards: number
  provider_id: string
  provider_type: string
  remote_object_id: string
  checksum_sha256: string
  size_bytes: number
  created_at: ISODateString
}

export interface WebJob {
  id: string
  inode_id: string
  chunk_index: number
  status: JobStatus
  attempts: number
  last_error: string | null
  worker_id: string | null
  created_at: ISODateString
  updated_at: ISODateString
  completed_at: ISODateString | null
}

export interface WebWorker {
  id: string
  node_id: string
  status: WorkerStatus
  jobs_processed: number
  cpu_percent: number
  memory_percent: number
  started_at: ISODateString
  last_heartbeat: ISODateString
}

export interface AetherEvent<P = unknown> {
  id: number
  subject: string
  payload: P
  created_at: ISODateString
}
