import type {
  AetherEvent as ContractAetherEvent,
  ApiResult as ContractApiResult,
  WebInode,
  WebJob,
  WebPhysicalChunk,
  WebProviderCredential,
  WebProviderLatencyResult,
  WebUser,
  WebVolume,
  WebWorker,
} from "@aether/contracts"

export type ApiResult<T> = ContractApiResult<T>
export type User = WebUser
export type Volume = WebVolume
export type Inode = WebInode
export type ProviderCredential = WebProviderCredential
export type ProviderLatencyResult = WebProviderLatencyResult
export type PhysicalChunk = WebPhysicalChunk
export type Job = WebJob
export type Worker = WebWorker
export type AetherEvent<P = unknown> = ContractAetherEvent<P>

export type {
  GoAllocateShardRequest,
  GoAllocateShardResponse,
  GoCreateFileRequest,
  GoCreateFileResponse,
  GoCreateFolderRequest,
  GoCreateFolderResponse,
  GoCreateVolumeRequest,
  GoFile,
  GoLinkProviderRequest,
  GoLinkProviderResponse,
  GoListFilesResponse,
  GoLoginRequest,
  GoLoginResponse,
  GoOAuthSessionRequest,
  GoOAuthSessionResponse,
  GoProvider,
  GoProviderHealthResponse,
  GoProviderLatencyResponse,
  GoRefreshResponse,
  GoRegisterRequest,
  GoRegisterResponse,
  GoLogoutResponse,
  GoVerifyResponse,
  GoVolume,
  InodeKind,
  JobStatus,
  ProviderStatus,
  ProviderType,
  SessionUser,
  WebCreateInodeRequest,
  WebCreateProviderRequest,
  WebCreateVolumeRequest,
  WebInodeDetailsResponse,
  WebListInodesResponse,
  WorkerStatus,
} from "@aether/contracts"
