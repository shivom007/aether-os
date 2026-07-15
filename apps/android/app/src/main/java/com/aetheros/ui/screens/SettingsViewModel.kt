package com.aetheros.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aetheros.api.AetherApi
import com.aetheros.api.ServerVolume
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ServerProvider(
    val id: Long,
    val provider: String,
    val status: String
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val api: AetherApi
) : ViewModel() {

    private val _volumes = MutableStateFlow<List<ServerVolume>>(emptyList())
    val volumes: StateFlow<List<ServerVolume>> = _volumes

    private val _providers = MutableStateFlow<List<ServerProvider>>(emptyList())
    val providers: StateFlow<List<ServerProvider>> = _providers

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading

    init {
        fetchData()
    }

    private fun fetchData() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                _volumes.value = api.listVolumes()
                _providers.value = api.listProviders()
            } catch (e: Exception) {
                // Handle error
            } finally {
                _isLoading.value = false
            }
        }
    }
}
