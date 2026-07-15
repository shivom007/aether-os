package com.aetheros.worker

import android.content.Context
import android.net.Uri
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ForegroundInfo
import androidx.core.app.NotificationCompat
import android.content.pm.ServiceInfo
import com.aetheros.api.AetherApi
import com.aetheros.crypto.ErasureEngine
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.InputStream
import kotlin.math.ceil

@HiltWorker
class UploadWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted workerParams: WorkerParameters,
    private val api: AetherApi
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val fileUriString = inputData.getString("FILE_URI") ?: return@withContext Result.failure()
        val fileUri = Uri.parse(fileUriString)
        val parentId = inputData.getString("PARENT_ID")
        val volumeId = inputData.getString("VOLUME_ID") ?: return@withContext Result.failure()
        val masterKeyB64 = inputData.getString("MASTER_KEY") ?: return@withContext Result.failure()
        val masterKey = android.util.Base64.decode(masterKeyB64, android.util.Base64.DEFAULT)

        try {
            val contentResolver = context.contentResolver
            
            // Query file size and name from contentResolver
            var fileSize = 0L
            var fileName = "unknown"
            val cursor = contentResolver.query(fileUri, null, null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                if (sizeIndex != -1) {
                    fileSize = cursor.getLong(sizeIndex)
                }
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                if (nameIndex != -1) {
                    fileName = cursor.getString(nameIndex) ?: "unknown"
                }
                cursor.close()
            }
            
            val mimeType = contentResolver.getType(fileUri) ?: "application/octet-stream"
            val fingerprint = com.aetheros.crypto.CryptoUtils.generateFingerprint(masterKey)
            
            // Register file in backend BEFORE uploading shards
            val registerResponse = api.registerFile(com.aetheros.api.FileMetadataRequest(
                name = fileName,
                folderId = parentId?.toLongOrNull(),
                volumeId = volumeId,
                size = fileSize,
                mimeType = mimeType,
                thumbnail = null,
                fingerprint = fingerprint
            ))
            val realVersionId = registerResponse.versionId
            
            val inputStream: InputStream? = contentResolver.openInputStream(fileUri)
            if (inputStream == null) return@withContext Result.failure()

            // Fetch KDF salt
            val volume = api.listVolumes().find { it.id == volumeId } ?: return@withContext Result.failure()
            val kdfSalt = android.util.Base64.decode(volume.kdfSalt, android.util.Base64.DEFAULT)

            val chunkSize = 5 * 1024 * 1024 // 5MB chunk
            val totalChunks = if (fileSize > 0) ceil(fileSize.toDouble() / chunkSize.toDouble()).toInt() else 1
            val buffer = ByteArray(chunkSize)
            var bytesRead: Int
            var chunkIndex = 0

            val notificationId = 1001
            suspend fun updateNotification() {
                val notification = NotificationCompat.Builder(context, "transfers")
                    .setContentTitle("Uploading File")
                    .setContentText("Uploading chunk ${chunkIndex + 1} of $totalChunks...")
                    .setSmallIcon(android.R.drawable.ic_menu_upload)
                    .setProgress(totalChunks, chunkIndex, false)
                    .setOngoing(true)
                    .build()
                val foregroundInfo = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    ForegroundInfo(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                } else {
                    ForegroundInfo(notificationId, notification)
                }
                setForeground(foregroundInfo)
            }
            updateNotification()

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                val actualChunk = if (bytesRead == chunkSize) buffer else buffer.copyOf(bytesRead)
                
                // 1. Ask Backend for Allocation
                val allocationRequest = com.aetheros.api.ShardAllocationRequest(
                    fileVersionId = realVersionId,
                    chunkIndex = chunkIndex,
                    chunkSize = bytesRead.toLong()
                )
                val allocation = api.allocateShards(allocationRequest)

                // 2. Encryption (AES-GCM V2)
                val keyAndNonce = com.aetheros.crypto.CryptoUtils.deriveChunkKeyV2(masterKey, kdfSalt, volumeId, chunkIndex)
                val aad = "aether:v2:$volumeId:$chunkIndex:$totalChunks".toByteArray(Charsets.UTF_8)
                val encryptedChunk = com.aetheros.crypto.CryptoUtils.encryptChunkV2(
                    plaintext = actualChunk,
                    chunkKey = keyAndNonce.chunkKey,
                    nonce = keyAndNonce.nonce,
                    aad = aad
                )

                // 3. Erasure Coding (Reed-Solomon) via Rust JNI
                val encodedShardsFlat = ErasureEngine.encodeShards(encryptedChunk)
                
                val shardSize = encodedShardsFlat.size / 14
                val multipartShards = mutableListOf<MultipartBody.Part>()
                val shardIds = mutableListOf<MultipartBody.Part>()

                // 4. Prepare Multiparts
                for (i in 0 until 14) {
                    val shardData = encodedShardsFlat.copyOfRange(i * shardSize, (i + 1) * shardSize)
                    val shardAllocation = allocation.allocations[i]

                    val requestBody = shardData.toRequestBody("application/octet-stream".toMediaTypeOrNull())
                    val shardPart = MultipartBody.Part.createFormData("shard_$i", "shard_$i.bin", requestBody)
                    val shardIdPart = MultipartBody.Part.createFormData("shardId_$i", null, shardAllocation.shardId.toRequestBody("text/plain".toMediaTypeOrNull()))

                    multipartShards.add(shardPart)
                    shardIds.add(shardIdPart)
                }

                // 5. Upload Batch
                api.uploadChunkBatch(multipartShards, shardIds)

                chunkIndex++
                updateNotification()
                setProgress(androidx.work.workDataOf(
                    "PROGRESS" to (chunkIndex.toFloat() / totalChunks * 100).toInt(),
                    "FILENAME" to fileName,
                    "TYPE" to "UPLOAD"
                ))
            }
            
            // Final completion notification
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            val completeNotification = NotificationCompat.Builder(context, "transfers")
                .setContentTitle("Upload Complete")
                .setContentText("File successfully uploaded.")
                .setSmallIcon(android.R.drawable.stat_sys_upload_done)
                .setAutoCancel(true)
                .build()
            manager.notify(notificationId + 1, completeNotification)

            inputStream.close()
            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            Result.retry()
        }
    }
}
