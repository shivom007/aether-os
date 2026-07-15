package com.aetheros.crypto

import java.security.InvalidAlgorithmParameterException
import java.security.InvalidKeyException
import java.security.NoSuchAlgorithmException
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object CryptoUtils {

    fun generateFingerprint(masterKey: ByteArray): String {
        val md = java.security.MessageDigest.getInstance("SHA-256")
        val digest = md.digest(masterKey)
        return android.util.Base64.encodeToString(digest, android.util.Base64.NO_WRAP)
    }

    /**
     * Equivalent to WebCrypto HKDF-SHA256 with 352 bits output.
     */
    fun deriveChunkKeyV2(
        masterKey: ByteArray,
        kdfSalt: ByteArray,
        volumeId: String,
        chunkIndex: Int
    ): ChunkKeyAndNonce {
        val info = "aether:v2:$volumeId:$chunkIndex:key_and_nonce".toByteArray(Charsets.UTF_8)
        
        // HKDF Extract
        val prk = hkdfExtract(kdfSalt, masterKey)
        
        // HKDF Expand to 44 bytes (352 bits)
        val okm = hkdfExpand(prk, info, 44)
        
        val chunkKey = okm.copyOfRange(0, 32)
        val nonce = okm.copyOfRange(32, 44)
        
        return ChunkKeyAndNonce(chunkKey, nonce)
    }

    /**
     * Encrypts plaintext using AES-256-GCM.
     */
    fun encryptChunkV2(
        plaintext: ByteArray,
        chunkKey: ByteArray,
        nonce: ByteArray,
        aad: ByteArray
    ): ByteArray {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(chunkKey, "AES")
            val gcmSpec = GCMParameterSpec(128, nonce) // 128-bit authentication tag
            
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, gcmSpec)
            cipher.updateAAD(aad)
            return cipher.doFinal(plaintext)
        } catch (e: Exception) {
            throw RuntimeException("Failed to encrypt chunk", e)
        }
    }

    /**
     * Decrypts ciphertext using AES-256-GCM.
     */
    fun decryptChunkV2(
        ciphertext: ByteArray,
        chunkKey: ByteArray,
        nonce: ByteArray,
        aad: ByteArray
    ): ByteArray {
        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val keySpec = SecretKeySpec(chunkKey, "AES")
            val gcmSpec = GCMParameterSpec(128, nonce) // 128-bit authentication tag
            
            cipher.init(Cipher.DECRYPT_MODE, keySpec, gcmSpec)
            cipher.updateAAD(aad)
            
            return cipher.doFinal(ciphertext)
        } catch (e: Exception) {
            throw RuntimeException("Decryption failed", e)
        }
    }

    private fun hkdfExtract(salt: ByteArray, ikm: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        val actualSalt = if (salt.isEmpty()) ByteArray(32) else salt
        mac.init(SecretKeySpec(actualSalt, "HmacSHA256"))
        return mac.doFinal(ikm)
    }

    private fun hkdfExpand(prk: ByteArray, info: ByteArray, length: Int): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(prk, "HmacSHA256"))
        
        val result = ByteArray(length)
        var generatedBytes = 0
        var block = ByteArray(0)
        var i = 1
        
        while (generatedBytes < length) {
            mac.update(block)
            mac.update(info)
            mac.update(i.toByte())
            block = mac.doFinal()
            
            val toCopy = Math.min(block.size, length - generatedBytes)
            System.arraycopy(block, 0, result, generatedBytes, toCopy)
            generatedBytes += toCopy
            i++
        }
        
        return result
    }
}

data class ChunkKeyAndNonce(
    val chunkKey: ByteArray,
    val nonce: ByteArray
)
