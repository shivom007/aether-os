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

@HiltViewModel
class VolumesViewModel @Inject constructor(
    private val api: AetherApi
) : ViewModel() {

    private val _volumes = MutableStateFlow<List<ServerVolume>>(emptyList())
    val volumes: StateFlow<List<ServerVolume>> = _volumes

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    init {
        fetchVolumes()
    }

    private fun fetchVolumes() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val list = api.listVolumes()
                _volumes.value = list
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to fetch volumes"
            } finally {
                _isLoading.value = false
            }
        }
    }
}
