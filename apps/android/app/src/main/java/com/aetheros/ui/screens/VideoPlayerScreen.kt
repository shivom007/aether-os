package com.aetheros.ui.screens

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView
import androidx.navigation.NavController
import com.aetheros.api.AetherApi
import com.aetheros.api.AuthRepository
import com.aetheros.downloader.AetherDataSourceFactory
import com.aetheros.downloader.StreamingManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class VideoPlayerViewModel @Inject constructor(
    private val api: AetherApi,
    private val streamingManager: StreamingManager,
    private val dataSourceFactory: AetherDataSourceFactory
) : ViewModel() {

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    val aetherDataSourceFactory = dataSourceFactory

    fun prepareStream(fileId: Long) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                
                if (streamingManager.masterKey == null || streamingManager.activeFile?.id != fileId) {
                    throw IllegalStateException("Stream context not initialized. Please go back and try again.")
                }
                
                // Fetch full file details only if Prompt-Time Prefetch didn't already populate it
                if (streamingManager.activeFile?.size == 0L || streamingManager.activeFile?.id != fileId) {
                    val fileDetails = api.getFileDetails(fileId)
                    streamingManager.activeFile = fileDetails
                }

                _isLoading.value = false
            } catch (e: Exception) {
                _error.value = e.message
                _isLoading.value = false
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VideoPlayerScreen(
    fileId: Long,
    fileName: String,
    navController: NavController,
    viewModel: VideoPlayerViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }

    LaunchedEffect(fileId) {
        viewModel.prepareStream(fileId)
    }

    LaunchedEffect(isLoading, error) {
        if (!isLoading && error == null && exoPlayer == null) {
            val mediaSource = ProgressiveMediaSource.Factory(viewModel.aetherDataSourceFactory)
                .createMediaSource(MediaItem.fromUri(Uri.parse("aether://stream/$fileId")))
                
            val loadControl = DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                    25000, // minBufferMs
                    50000, // maxBufferMs
                    500,   // bufferForPlaybackMs - Start playing almost instantly!
                    2000   // bufferForPlaybackAfterRebufferMs
                )
                .build()
                
            exoPlayer = ExoPlayer.Builder(context)
                .setLoadControl(loadControl)
                .build()
                .apply {
                    setMediaSource(mediaSource)
                    prepare()
                    playWhenReady = true
                }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            exoPlayer?.release()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(fileName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Black,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        },
        containerColor = Color.Black
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding).background(Color.Black)) {
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center), color = Color.White)
            } else if (error != null) {
                Text(
                    text = "Failed to load stream: $error",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                exoPlayer?.let { player ->
                    AndroidView(
                        factory = { ctx ->
                            PlayerView(ctx).apply {
                                this.player = player
                                setKeepScreenOn(true)
                            }
                        },
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}
