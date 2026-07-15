package com.aetheros.downloader

import android.net.Uri
import android.util.Log
import androidx.media3.common.C
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSpec
import com.aetheros.api.AetherApi
import com.aetheros.api.ServerShard
import com.aetheros.crypto.CryptoUtils
import com.aetheros.crypto.ErasureEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import java.util.concurrent.ConcurrentHashMap

class AetherDataSource(
    private val api: AetherApi,
    private val streamingManager: StreamingManager
) : BaseDataSource(/* isNetwork = */ true) {

    private var currentUri: Uri? = null
    private var currentDataSpec: DataSpec? = null
    private var bytesRemaining: Long = 0
    private var positionOffset: Long = 0

    // Prefetching Engine — per-instance deferred map for in-flight downloads
    private val prefetchScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val prefetchCache = ConcurrentHashMap<Int, Deferred<ByteArray>>()
    private val PREFETCH_WINDOW = 3

    // Currently buffered chunk for sequential reads
    private var cachedChunkIndex: Int = -1
    private var cachedChunkData: ByteArray? = null

    companion object {
        const val CHUNK_SIZE = 5L * 1024 * 1024 // 5MB for videos
        const val DATA_SHARDS = 10
        const val TOTAL_SHARDS = 14
    }

    override fun open(dataSpec: DataSpec): Long {
        transferInitializing(dataSpec)
        currentUri = dataSpec.uri
        currentDataSpec = dataSpec
        
        val fileDetails = streamingManager.activeFile ?: throw IllegalStateException("StreamingManager activeFile is null")

        positionOffset = dataSpec.position
        
        bytesRemaining = if (dataSpec.length != C.LENGTH_UNSET.toLong()) {
            dataSpec.length
        } else {
            fileDetails.size - dataSpec.position
        }

        // Eagerly start prefetching the chunk at the current position + next chunks
        // This fires network requests BEFORE ExoPlayer's first read() call
        val masterKey = streamingManager.masterKey
        val kdfSalt = streamingManager.kdfSalt
        if (masterKey != null && kdfSalt != null) {
            val startChunkIndex = (dataSpec.position / CHUNK_SIZE).toInt()
            val totalChunks = fileDetails.versions?.maxByOrNull { it.version }?.chunks?.size ?: 0
            for (i in 0..PREFETCH_WINDOW) {
                val idx = startChunkIndex + i
                if (idx < totalChunks && !prefetchCache.containsKey(idx)) {
                    // Skip if already in the global LRU cache
                    if (streamingManager.getCachedChunk(fileDetails.id, idx) == null) {
                        prefetchCache[idx] = prefetchScope.async {
                            fetchAndDecryptChunk(fileDetails, masterKey, kdfSalt, idx)
                        }
                    }
                }
            }
        }

        transferStarted(dataSpec)
        return bytesRemaining
    }

    override fun read(buffer: ByteArray, offset: Int, readLength: Int): Int {
        if (bytesRemaining == 0L) return C.RESULT_END_OF_INPUT

        val fileDetails = streamingManager.activeFile ?: return C.RESULT_END_OF_INPUT
        val masterKey = streamingManager.masterKey ?: return C.RESULT_END_OF_INPUT
        val kdfSalt = streamingManager.kdfSalt ?: return C.RESULT_END_OF_INPUT
        
        val targetChunkIndex = (positionOffset / CHUNK_SIZE).toInt()
        val chunkOffset = (positionOffset % CHUNK_SIZE).toInt()

        // Fetch chunk if not cached locally in this DataSource instance
        if (cachedChunkIndex != targetChunkIndex || cachedChunkData == null) {
            try {
                // 1. Check the global LRU cache first (instant for seeks to previously-watched chunks)
                val lruHit = streamingManager.getCachedChunk(fileDetails.id, targetChunkIndex)
                if (lruHit != null) {
                    cachedChunkData = lruHit
                    cachedChunkIndex = targetChunkIndex
                    // Still trigger prefetch for upcoming chunks
                    launchPrefetch(fileDetails, masterKey, kdfSalt, targetChunkIndex)
                } else {
                    // 2. Download, reconstruct, and decrypt
                    runBlocking {
                        // Trigger prefetch for upcoming chunks FIRST
                        val totalChunks = fileDetails.versions?.maxByOrNull { it.version }?.chunks?.size ?: 0
                        for (i in 1..PREFETCH_WINDOW) {
                            val nextIndex = targetChunkIndex + i
                            if (nextIndex < totalChunks && !prefetchCache.containsKey(nextIndex)) {
                                if (streamingManager.getCachedChunk(fileDetails.id, nextIndex) == null) {
                                    prefetchCache[nextIndex] = prefetchScope.async {
                                        fetchAndDecryptChunk(fileDetails, masterKey, kdfSalt, nextIndex)
                                    }
                                }
                            }
                        }

                        // Get current chunk (await prefetch or start new download)
                        val decrypted = getOrFetchChunk(fileDetails, masterKey, kdfSalt, targetChunkIndex)
                        
                        // Store in global LRU cache for instant seeking
                        streamingManager.putCachedChunk(fileDetails.id, targetChunkIndex, decrypted)
                        cachedChunkData = decrypted
                        
                        // Clean up per-instance prefetch entry
                        prefetchCache.remove(targetChunkIndex)
                    }
                    cachedChunkIndex = targetChunkIndex
                }
            } catch (e: Exception) {
                Log.e("AetherDataSource", "Failed to fetch chunk $targetChunkIndex", e)
                return C.RESULT_END_OF_INPUT
            }
        }

        val availableInChunk = cachedChunkData!!.size - chunkOffset
        if (availableInChunk <= 0) return C.RESULT_END_OF_INPUT

        val bytesToRead = minOf(readLength.toLong(), bytesRemaining, availableInChunk.toLong()).toInt()
        System.arraycopy(cachedChunkData!!, chunkOffset, buffer, offset, bytesToRead)

        positionOffset += bytesToRead
        bytesRemaining -= bytesToRead
        bytesTransferred(bytesToRead)

        return bytesToRead
    }

    override fun getUri(): Uri? = currentUri

    override fun close() {
        if (currentUri != null) {
            currentUri = null
            transferEnded()
        }
        // Cancel in-flight downloads but do NOT clear the global LRU cache
        prefetchScope.coroutineContext.cancelChildren()
        prefetchCache.clear()
        // Reset local state but leave global cache intact for instant seeks
        cachedChunkIndex = -1
        cachedChunkData = null
    }

    /** Fire-and-forget prefetch for chunks ahead of the current position. */
    private fun launchPrefetch(
        fileDetails: com.aetheros.api.ServerFile,
        masterKey: ByteArray,
        kdfSalt: ByteArray,
        currentChunkIndex: Int
    ) {
        val totalChunks = fileDetails.versions?.maxByOrNull { it.version }?.chunks?.size ?: 0
        for (i in 1..PREFETCH_WINDOW) {
            val nextIndex = currentChunkIndex + i
            if (nextIndex < totalChunks && !prefetchCache.containsKey(nextIndex)) {
                if (streamingManager.getCachedChunk(fileDetails.id, nextIndex) == null) {
                    prefetchCache[nextIndex] = prefetchScope.async {
                        fetchAndDecryptChunk(fileDetails, masterKey, kdfSalt, nextIndex)
                    }
                }
            }
        }
    }

    private suspend fun getOrFetchChunk(
        fileDetails: com.aetheros.api.ServerFile,
        masterKey: ByteArray,
        kdfSalt: ByteArray,
        chunkIndex: Int
    ): ByteArray {
        val deferred = prefetchCache.getOrPut(chunkIndex) {
            prefetchScope.async {
                fetchAndDecryptChunk(fileDetails, masterKey, kdfSalt, chunkIndex)
            }
        }
        return deferred.await()
    }

    private suspend fun fetchAndDecryptChunk(
        fileDetails: com.aetheros.api.ServerFile,
        masterKey: ByteArray,
        kdfSalt: ByteArray,
        chunkIndex: Int
    ): ByteArray {
        val version = fileDetails.versions?.maxByOrNull { it.version }
            ?: throw IllegalStateException("No versions found")
        val chunks = version.chunks ?: throw IllegalStateException("No chunks found")
        val chunk = chunks.find { it.chunkIndex == chunkIndex }
            ?: throw IllegalStateException("Chunk $chunkIndex is missing")
        val shards = chunk.shards ?: throw IllegalStateException("Shards missing")

        // 1. Dynamic Hedging: Download minimum shards needed
        val fetchedShards = fetchMinimumShardsWithHedging(shards)
        
        // 2. Reconstruct
        val isLastChunk = (chunkIndex == chunks.size - 1)
        var unencryptedSize = CHUNK_SIZE
        if (isLastChunk) {
            if (fileDetails.size == 0L) unencryptedSize = 0L
            else if (fileDetails.size % CHUNK_SIZE != 0L) unencryptedSize = fileDetails.size % CHUNK_SIZE
        }
        val originalSize = unencryptedSize + 16 // AES-GCM tag

        val presentIndices = ByteArray(DATA_SHARDS)
        val presentShardsFlat = ByteArray(DATA_SHARDS * fetchedShards.first { it != null }!!.size)
        
        var added = 0
        for (i in 0 until TOTAL_SHARDS) {
            val sData = fetchedShards[i]
            if (sData != null) {
                presentIndices[added] = i.toByte()
                System.arraycopy(sData, 0, presentShardsFlat, added * sData.size, sData.size)
                added++
                if (added == DATA_SHARDS) break
            }
        }
        
        val reconstructed = ErasureEngine.reconstructShards(presentShardsFlat, presentIndices, originalSize.toInt())
        
        // 3. Decrypt
        val aadString = "aether:v2:${fileDetails.volumeId}:$chunkIndex:${chunks.size}"
        val keys = CryptoUtils.deriveChunkKeyV2(masterKey, kdfSalt, fileDetails.volumeId, chunkIndex)
        
        return CryptoUtils.decryptChunkV2(
            ciphertext = reconstructed,
            chunkKey = keys.chunkKey,
            nonce = keys.nonce,
            aad = aadString.toByteArray(Charsets.UTF_8)
        )
    }

    private suspend fun fetchMinimumShardsWithHedging(shards: List<ServerShard>): Array<ByteArray?> = coroutineScope {
        val fetched = Array<ByteArray?>(TOTAL_SHARDS) { null }
        val channel = Channel<Pair<Int, ByteArray?>>(TOTAL_SHARDS)

        val deferreds = shards.map { shard ->
            async {
                var bytes: ByteArray? = null
                try {
                    val shardIdStr = shard.id.toString()
                    bytes = api.downloadShard(shardIdStr).bytes()
                } catch (e: Exception) {
                    Log.w("AetherDataSource", "Shard ${shard.shardIndex} failed", e)
                }
                channel.send(Pair(shard.shardIndex, bytes))
            }
        }

        var successes = 0
        var failures = 0
        while (successes < DATA_SHARDS && failures <= TOTAL_SHARDS - DATA_SHARDS) {
            val (index, bytes) = channel.receive()
            if (bytes != null) {
                if (fetched[index] == null) {
                    fetched[index] = bytes
                    successes++
                }
            } else {
                failures++
            }
        }

        deferreds.forEach { it.cancel() }
        channel.close()
        
        if (successes < DATA_SHARDS) {
            throw java.io.IOException("Network failure: Could not download the minimum $DATA_SHARDS shards.")
        }
        
        fetched
    }
}
