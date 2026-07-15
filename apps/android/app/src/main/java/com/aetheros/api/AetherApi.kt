package com.aetheros.api

import retrofit2.http.*
import okhttp3.MultipartBody
import okhttp3.ResponseBody

// Data Models
data class FileMetadataRequest(
    val name: String,
    val folderId: Long?,
    val volumeId: String,
    val size: Long,
    val mimeType: String,
    val thumbnail: String?,
    val fingerprint: String?
)

data class ServerFile(
    val id: Long,
    val userId: Long,
    val volumeId: String,
    val folderId: Long?,
    val name: String,
    val size: Long,
    val mimeType: String,
    val thumbnail: String?,
    val fingerprint: String?,
    val createdAt: String,
    val updatedAt: String,
    val versions: List<ServerFileVersion>? = null
)

data class ServerFolder(
    val id: Long,
    val name: String
)

data class FsListResponse(
    val folders: List<ServerFolder>,
    val files: List<ServerFile>
)

data class RegisterFileResponse(
    val file: ServerFile,
    val versionId: Long,
    val completedChunks: List<Int>
)

data class ShardAllocationRequest(
    val fileVersionId: Long,
    val chunkIndex: Int,
    val chunkSize: Long
)

data class ShardAllocation(
    val shardId: String,
    val provider: String
)

data class ChunkAllocationResponse(
    val chunkId: Long,
    val allocations: List<ShardAllocation>
)

data class AuthLoginRequest(
    val username: String,
    val authHash: String
)

data class AuthLoginResponse(
    val token: String
)

data class AuthRegisterResponse(
    val message: String,
    val userId: Long
)

data class CreateFolderRequest(
    val name: String,
    val parentId: Long?,
    val volumeId: String
)

data class ServerVolume(
    val id: String,
    val name: String,
    val kdfSalt: String,
    val masterKeyFingerprint: String
)

data class ServerShard(
    val id: Long,
    val chunkId: Long,
    val shardIndex: Int,
    val provider: String,
    val providerFileId: String,
    val status: String
)

data class ServerChunk(
    val id: Long,
    val fileVersionId: Long,
    val chunkIndex: Int,
    val size: Long,
    val shards: List<ServerShard>? = null
)

data class ServerFileVersion(
    val id: Long,
    val fileId: Long,
    val version: Int,
    val size: Long,
    val chunks: List<ServerChunk>? = null
)

interface AetherApi {
    @POST("auth/login")
    suspend fun login(@Body request: AuthLoginRequest): AuthLoginResponse

    @POST("auth/register")
    suspend fun register(@Body request: AuthLoginRequest): AuthRegisterResponse

    @GET("volumes")
    suspend fun listVolumes(): List<ServerVolume>

    @GET("providers")
    suspend fun listProviders(): List<com.aetheros.ui.screens.ServerProvider>

    @GET("fs")
    suspend fun listFiles(
        @Query("volumeId") volumeId: String? = null,
        @Query("parentId") parentId: Long? = null
    ): FsListResponse

    @POST("fs/folder")
    suspend fun createFolder(@Body request: CreateFolderRequest): ServerFolder

    @GET("fs/file/{id}")
    suspend fun getFileDetails(@Path("id") id: Long): ServerFile

    @POST("fs/file")
    suspend fun registerFile(@Body request: FileMetadataRequest): RegisterFileResponse

    @POST("shards/allocate")
    suspend fun allocateShards(@Body request: ShardAllocationRequest): ChunkAllocationResponse

    @Multipart
    @POST("shards/upload/batch")
    suspend fun uploadChunkBatch(
        @Part shards: List<MultipartBody.Part>,
        @Part shardIds: List<MultipartBody.Part>
    ): ResponseBody

    @GET("shards/download/{id}")
    @Streaming
    suspend fun downloadShard(@Path("id") shardId: String): ResponseBody
}
