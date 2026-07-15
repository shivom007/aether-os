package com.aetheros.crypto

object ErasureEngine {
    init {
        System.loadLibrary("aether_jni")
    }

    /**
     * Takes an encrypted chunk (e.g. 5MB) and encodes it into 14 shards.
     * Returns a flat ByteArray containing all 14 shards concatenated.
     */
    external fun encodeShards(input: ByteArray): ByteArray

    /**
     * Reconstructs the original 5MB chunk from exactly 10 shards.
     * [presentShardsFlat] is a flat ByteArray of the 10 available shards concatenated together.
     * [presentIndices] is a ByteArray of the 10 shard indices (0..13) corresponding to the shards in presentShardsFlat.
     * [originalSize] is the size of the unpadded original data (e.g. 5242880 for a full chunk).
     */
    external fun reconstructShards(
        presentShardsFlat: ByteArray,
        presentIndices: ByteArray,
        originalSize: Int
    ): ByteArray

    /**
     * Derives a 32-byte master key using Argon2id.
     */
    external fun deriveMasterKeyArgon2(password: ByteArray, salt: ByteArray): ByteArray
}
