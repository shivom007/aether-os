package com.aetheros.worker

import android.content.Context
import android.os.Environment
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ForegroundInfo
import androidx.core.app.NotificationCompat
import android.content.pm.ServiceInfo
import com.aetheros.api.AetherApi
import com.aetheros.api.ServerShard
import com.aetheros.crypto.CryptoUtils
import com.aetheros.crypto.ErasureEngine
import androidx.hilt.work.HiltWorker
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

@HiltWorker
class DownloadWorker @AssistedInject constructor(
    @Assisted private val context: Context,
    @Assisted workerParams: WorkerParameters,
    private val api: AetherApi
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val DATA_SHARDS = 10
        const val TOTAL_SHARDS = 14
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val fileId = inputData.getLong("FILE_ID", -1L)
        val volumeId = inputData.getString("VOLUME_ID") ?: return@withContext Result.failure()
        val masterKeyB64 = inputData.getString("MASTER_KEY") ?: return@withContext Result.failure()
        if (fileId == -1L) return@withContext Result.failure()

        try {
            val masterKey = android.util.Base64.decode(masterKeyB64, android.util.Base64.DEFAULT)

            // 1. Fetch File Manifest
            val fileDetails = api.getFileDetails(fileId)
            val version = fileDetails.versions?.maxByOrNull { it.version }
                ?: throw IllegalStateException("No versions found")
                
            val chunks = version.chunks ?: throw IllegalStateException("No chunks found")
            val totalChunks = chunks.size
            
            // Fetch volume for KDF Salt
            val volume = api.listVolumes().find { it.id == volumeId } ?: throw IllegalStateException("Volume not found")
            val kdfSalt = android.util.Base64.decode(volume.kdfSalt, android.util.Base64.DEFAULT)

            // 2. Prepare output file
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val outputFile = File(downloadsDir, fileDetails.name)
            val outputStream = FileOutputStream(outputFile)

            val notificationId = 1002
            suspend fun updateNotification(chunkIndex: Int) {
                val notification = NotificationCompat.Builder(context, "transfers")
                    .setContentTitle("Downloading File")
                    .setContentText("Downloading chunk ${chunkIndex + 1} of $totalChunks...")
                    .setSmallIcon(android.R.drawable.stat_sys_download)
                    .setProgress(totalChunks, chunkIndex, false)
                    .setOngoing(true)
                    .build()
                val foregroundInfo = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    ForegroundInfo(notificationId, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                } else {
                    ForegroundInfo(notificationId, notification)
                }
                setForeground(foregroundInfo)
                setProgress(androidx.work.workDataOf(
                    "PROGRESS" to (chunkIndex.toFloat() / totalChunks * 100).toInt(),
                    "FILENAME" to fileDetails.name,
                    "TYPE" to "DOWNLOAD"
                ))
            }
            updateNotification(0)

            // 3. Process each chunk sequentially
            for (i in 0 until totalChunks) {
                val chunk = chunks.find { it.chunkIndex == i }
                    ?: throw IllegalStateException("Chunk $i is missing")
                
                val shards = chunk.shards ?: throw IllegalStateException("Shards missing for chunk $i")
                
                // 3a. Download shards with Dynamic Hedging
                val fetchedShards = fetchMinimumShardsWithHedging(shards)
                
                // 3b. Reconstruct chunk
                val isLastChunk = (i == totalChunks - 1)
                val CHUNK_SIZE = 5L * 1024 * 1024
                
                var unencryptedSize = CHUNK_SIZE
                if (isLastChunk) {
                    if (fileDetails.size == 0L) {
                        unencryptedSize = 0L
                    } else if (fileDetails.size % CHUNK_SIZE != 0L) {
                        unencryptedSize = fileDetails.size % CHUNK_SIZE
                    }
                }
                
                val originalSize = unencryptedSize + 16 // GCM tag
                
                val presentIndices = ByteArray(DATA_SHARDS)
                val presentShardsFlat = ByteArray(DATA_SHARDS * fetchedShards.first { it != null }!!.size)
                
                var added = 0
                for (shardIndex in 0 until TOTAL_SHARDS) {
                    val data = fetchedShards[shardIndex]
                    if (data != null && added < DATA_SHARDS) {
                        presentIndices[added] = shardIndex.toByte()
                        System.arraycopy(data, 0, presentShardsFlat, added * data.size, data.size)
                        added++
                    }
                }
                
                val reconstructed = ErasureEngine.reconstructShards(presentShardsFlat, presentIndices, originalSize.toInt())
                
                // 3c. Decrypt chunk
                val aadString = "aether:v2:$volumeId:$i:$totalChunks"
                val aad = aadString.toByteArray(Charsets.UTF_8)
                
                val keys = CryptoUtils.deriveChunkKeyV2(masterKey, kdfSalt, volumeId, i)
                val plaintext = CryptoUtils.decryptChunkV2(reconstructed, keys.chunkKey, keys.nonce, aad)
                
                outputStream.write(plaintext)
                
                if (i < totalChunks - 1) {
                    updateNotification(i + 1)
                }
            }
            
            outputStream.close()
            
            // Final completion notification
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            val completeNotification = NotificationCompat.Builder(context, "transfers")
                .setContentTitle("Download Complete")
                .setContentText("File successfully downloaded to Downloads.")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setAutoCancel(true)
                .build()
            manager.notify(notificationId + 1, completeNotification)
            
            Result.success()
        } catch (e: Exception) {
            Log.e("DownloadWorker", "Download failed", e)
            Result.failure()
        }
    }

    private suspend fun fetchMinimumShardsWithHedging(shards: List<ServerShard>): Array<ByteArray?> = coroutineScope {
        val fetched = arrayOfNulls<ByteArray>(TOTAL_SHARDS)
        val channel = kotlinx.coroutines.channels.Channel<Pair<Int, ByteArray?>>(TOTAL_SHARDS)
        
        val deferreds = shards.map { shard ->
            async {
                var bytes: ByteArray? = null
                try {
                    bytes = api.downloadShard(shard.id.toString()).bytes()
                } catch (e: Exception) {
                    Log.w("DownloadWorker", "Failed to fetch shard ${shard.shardIndex}", e)
                }
                channel.send(Pair(shard.shardIndex, bytes))
            }
        }
        
        var successCount = 0
        var failures = 0
        while (successCount < DATA_SHARDS && failures <= TOTAL_SHARDS - DATA_SHARDS) {
            val (index, bytes) = channel.receive()
            if (bytes != null) {
                fetched[index] = bytes
                successCount++
            } else {
                failures++
            }
        }
        
        deferreds.forEach { it.cancel() }
        
        if (successCount < DATA_SHARDS) {
            throw IllegalStateException("Failed to download at least 10 shards")
        }
        
        fetched
    }
}
