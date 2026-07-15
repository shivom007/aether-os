package com.aetheros.downloader

import com.aetheros.api.ServerFile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StreamingManager @Inject constructor() {
    var masterKey: ByteArray? = null
    var activeFile: ServerFile? = null
    var kdfSalt: ByteArray? = null



    /**
     * Global LRU cache for decrypted chunk plaintexts.
     * Survives seek operations so previously-watched chunks load instantly.
     * Keyed by "${fileId}_${chunkIndex}".
     * Max 10 entries (~50MB for 5MB chunks).
     */
    private val MAX_CACHED_CHUNKS = 10
    val chunkPlaintextCache: LinkedHashMap<String, ByteArray> = object : LinkedHashMap<String, ByteArray>(
        MAX_CACHED_CHUNKS + 1, 0.75f, true // accessOrder = true for LRU
    ) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, ByteArray>?): Boolean {
            return size > MAX_CACHED_CHUNKS
        }
    }

    @Synchronized
    fun getCachedChunk(fileId: Long, chunkIndex: Int): ByteArray? {
        return chunkPlaintextCache["${fileId}_${chunkIndex}"]
    }

    @Synchronized
    fun putCachedChunk(fileId: Long, chunkIndex: Int, data: ByteArray) {
        chunkPlaintextCache["${fileId}_${chunkIndex}"] = data
    }

    fun clearForNewFile() {
        chunkPlaintextCache.clear()
    }
}
