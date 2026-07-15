package com.aetheros.api

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: AetherApi,
    @ApplicationContext private val context: Context
) {

    private val sharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "aether_auth",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    suspend fun login(email: String, password: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val authHash = getAuthHash(password, email)
            val response = api.login(AuthLoginRequest(email.lowercase(), authHash))
            
            // Store token securely
            sharedPreferences.edit().putString("jwt_token", response.token).apply()
            
            Result.success(response.token)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(email: String, password: String): Result<Long> = withContext(Dispatchers.IO) {
        try {
            val authHash = getAuthHash(password, email)
            val response = api.register(AuthLoginRequest(email.lowercase(), authHash))
            Result.success(response.userId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        sharedPreferences.edit().remove("jwt_token").apply()
    }

    fun isLoggedIn(): Boolean {
        return sharedPreferences.getString("jwt_token", null) != null
    }

    private fun getAuthHash(password: String, email: String): String {
        val input = password + email.lowercase()
        val md = MessageDigest.getInstance("SHA-256")
        val digest = md.digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
