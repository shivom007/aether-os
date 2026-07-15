package com.aetheros.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aetheros.api.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    private val _loginSuccess = MutableStateFlow(false)
    val loginSuccess: StateFlow<Boolean> = _loginSuccess

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            val result = authRepository.login(email, password)
            if (result.isSuccess) {
                _loginSuccess.value = true
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Login failed"
            }
            
            _isLoading.value = false
        }
    }

    fun register(email: String, password: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            
            val result = authRepository.register(email, password)
            if (result.isSuccess) {
                // Auto login after register
                val loginResult = authRepository.login(email, password)
                if (loginResult.isSuccess) {
                    _loginSuccess.value = true
                } else {
                    _error.value = "Registered, but login failed."
                }
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Registration failed"
            }
            
            _isLoading.value = false
        }
    }
}
