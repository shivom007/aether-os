package com.aetheros.api

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.ConnectionPool
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.Dispatcher
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

class AuthInterceptor(private val context: Context) : Interceptor {
    // Cache SharedPreferences so we don't re-derive the Android Keystore key on every request
    private val sharedPreferences: SharedPreferences by lazy {
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

    // Cache the token string itself — avoids even the SharedPreferences read on every call
    @Volatile
    private var cachedToken: String? = null

    fun invalidateToken() {
        cachedToken = null
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = cachedToken ?: sharedPreferences.getString("jwt_token", null)?.also {
            cachedToken = it
        }

        val requestBuilder = chain.request().newBuilder()
        if (token != null) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    // Connect to deployed Go backend on Railway
    private const val BASE_URL = "https://backend-aetheros.up.railway.app/api/v1/"

    @Provides
    @Singleton
    fun provideAetherApi(@ApplicationContext context: Context): AetherApi {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val dispatcher = Dispatcher().apply {
            maxRequests = 64
            maxRequestsPerHost = 20
        }

        // Keep connections alive to amortize TLS handshake cost across shard downloads
        val connectionPool = ConnectionPool(
            maxIdleConnections = 10,
            keepAliveDuration = 5,
            timeUnit = TimeUnit.MINUTES
        )

        val okHttpClient = OkHttpClient.Builder()
            .dispatcher(dispatcher)
            .connectionPool(connectionPool)
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .addInterceptor(AuthInterceptor(context))
            .addInterceptor(loggingInterceptor)
            .build()

        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AetherApi::class.java)
    }
}

