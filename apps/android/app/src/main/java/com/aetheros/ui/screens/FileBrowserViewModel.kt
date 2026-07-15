package com.aetheros.ui.screens

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aetheros.api.AetherApi
import com.aetheros.api.ServerFile
import com.aetheros.downloader.StreamingManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class Breadcrumb(val id: Long?, val name: String)

sealed class AetherItem {
    abstract val id: Long
    abstract val name: String

    data class Folder(
        override val id: Long,
        override val name: String
    ) : AetherItem()

    data class File(
        override val id: Long,
        override val name: String,
        val size: String,
        val isVideo: Boolean
    ) : AetherItem()
}

@HiltViewModel
class FileBrowserViewModel @Inject constructor(
    private val api: AetherApi,
    savedStateHandle: androidx.lifecycle.SavedStateHandle,
    private val streamingManager: StreamingManager
) : ViewModel() {

    private val volumeId: String = checkNotNull(savedStateHandle["volumeId"])

    private val _volume = MutableStateFlow<com.aetheros.api.ServerVolume?>(null)
    val volume: StateFlow<com.aetheros.api.ServerVolume?> = _volume

    fun setStreamContext(file: AetherItem.File, masterKey: ByteArray, kdfSalt: ByteArray) {
        streamingManager.masterKey = masterKey
        streamingManager.kdfSalt = kdfSalt
        
        // Only set the placeholder activeFile if startPromptTimePrefetch didn't already populate the real one
        if (streamingManager.activeFile?.id != file.id) {
            streamingManager.activeFile = com.aetheros.api.ServerFile(
                id = file.id,
                userId = 0L,
                volumeId = volumeId,
                folderId = null,
                name = file.name,
                size = 0L, // Placeholder
                mimeType = "video/mp4",
                thumbnail = null,
                fingerprint = null,
                createdAt = "",
                updatedAt = "",
                versions = emptyList() // The real ones are fetched by VideoPlayerScreen
            )
        }
    }



    private val _items = MutableStateFlow<List<AetherItem>>(emptyList())
    val items: StateFlow<List<AetherItem>> = _items

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _path = MutableStateFlow<List<Breadcrumb>>(listOf(Breadcrumb(null, "Vault")))
    val path: StateFlow<List<Breadcrumb>> = _path

    init {
        viewModelScope.launch {
            try {
                _volume.value = api.listVolumes().find { it.id == volumeId }
            } catch (e: Exception) {
                // Ignore for now
            }
        }
        fetchFiles()
    }

    fun fetchFiles() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val currentParentId = _path.value.last().id
                val response = api.listFiles(volumeId = volumeId, parentId = currentParentId)
                
                val folders = response.folders.map { AetherItem.Folder(it.id, it.name) }
                val files = response.files.map { serverFile ->
                    AetherItem.File(
                        id = serverFile.id,
                        name = serverFile.name,
                        size = formatSize(serverFile.size),
                        isVideo = serverFile.mimeType.startsWith("video/")
                    )
                }
                
                _items.value = folders + files
            } catch (e: Exception) {
                Log.e("FileBrowserViewModel", "Failed to fetch files", e)
                _error.value = e.message ?: "Failed to connect to Aether node"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun navigateToFolder(id: Long, name: String) {
        val currentPath = _path.value.toMutableList()
        currentPath.add(Breadcrumb(id, name))
        _path.value = currentPath
        fetchFiles()
    }

    fun navigateUp(): Boolean {
        val currentPath = _path.value
        if (currentPath.size > 1) {
            _path.value = currentPath.dropLast(1)
            fetchFiles()
            return true
        }
        return false
    }

    fun navigateToBreadcrumbIndex(index: Int) {
        val currentPath = _path.value
        if (index in currentPath.indices) {
            _path.value = currentPath.take(index + 1)
            fetchFiles()
        }
    }

    private fun formatSize(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format("%.1f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format("%.1f MB", mb)
        val gb = mb / 1024.0
        return String.format("%.1f GB", gb)
    }
}
