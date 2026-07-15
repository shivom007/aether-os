package com.aetheros.downloader

import androidx.media3.datasource.DataSource
import com.aetheros.api.AetherApi
import javax.inject.Inject

class AetherDataSourceFactory @Inject constructor(
    private val api: AetherApi,
    private val streamingManager: StreamingManager
) : DataSource.Factory {
    override fun createDataSource(): DataSource {
        return AetherDataSource(api, streamingManager)
    }
}
