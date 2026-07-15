package com.aetheros.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import android.net.Uri
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SwapVert
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.aetheros.ui.theme.AetherPrimary
import com.aetheros.ui.theme.AetherSecondary
import com.aetheros.worker.UploadWorker
import java.util.UUID
import com.aetheros.ui.components.PassphrasePrompt
import com.aetheros.crypto.ErasureEngine
import com.aetheros.crypto.CryptoUtils
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class AetherFile(val name: String, val size: String, val isVideo: Boolean)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileBrowserScreen(
    volumeId: String,
    viewModel: FileBrowserViewModel = hiltViewModel(),
    navController: NavController
) {
    val context = LocalContext.current
    val items by viewModel.items.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val path by viewModel.path.collectAsState()
    val volume by viewModel.volume.collectAsState()
    
    var pendingAction by remember { mutableStateOf<((ByteArray) -> Unit)?>(null) }
    var promptTitle by remember { mutableStateOf("") }
    var promptMessage by remember { mutableStateOf("") }
    var isUnlocking by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    if (pendingAction != null && volume != null) {
        PassphrasePrompt(
            title = promptTitle,
            message = promptMessage,
            isLoading = isUnlocking,
            onConfirm = { pass ->
                isUnlocking = true
                coroutineScope.launch(kotlinx.coroutines.Dispatchers.IO) {
                    val saltBytes = android.util.Base64.decode(volume!!.kdfSalt, android.util.Base64.DEFAULT)
                    val masterKey = ErasureEngine.deriveMasterKeyArgon2(pass.toByteArray(Charsets.UTF_8), saltBytes)
                    val fingerprint = CryptoUtils.generateFingerprint(masterKey)
                    
                    withContext(kotlinx.coroutines.Dispatchers.Main) {
                        isUnlocking = false
                        if (fingerprint == volume!!.masterKeyFingerprint) {
                            pendingAction?.invoke(masterKey)
                            pendingAction = null
                        } else {
                            android.widget.Toast.makeText(context, "Incorrect passphrase!", android.widget.Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            },
            onCancel = { pendingAction = null }
        )
    }

    BackHandler(enabled = path.size > 1) {
        viewModel.navigateUp()
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            promptTitle = "Upload File"
            promptMessage = "Enter volume passphrase to encrypt and upload this file."
            pendingAction = { masterKey: ByteArray ->
                val workManager = WorkManager.getInstance(context)
                val parentId = path.last().id?.toString()
                val masterKeyB64 = android.util.Base64.encodeToString(masterKey, android.util.Base64.DEFAULT)
                val inputData = workDataOf(
                    "FILE_URI" to uri.toString(),
                    "INODE_ID" to UUID.randomUUID().toString(),
                    "VERSION_ID" to UUID.randomUUID().toString(),
                    "PARENT_ID" to parentId,
                    "MASTER_KEY" to masterKeyB64,
                    "VOLUME_ID" to volumeId
                )
                val uploadRequest = OneTimeWorkRequestBuilder<UploadWorker>()
                    .setInputData(inputData)
                    .addTag("transfer")
                    .build()
                
                workManager.enqueue(uploadRequest)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        path.forEachIndexed { index, breadcrumb ->
                            Text(
                                text = breadcrumb.name,
                                fontWeight = if (index == path.size - 1) FontWeight.Bold else FontWeight.Normal,
                                color = if (index == path.size - 1) MaterialTheme.colorScheme.onBackground else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.clickable { viewModel.navigateToBreadcrumbIndex(index) }
                            )
                            if (index < path.size - 1) {
                                Text(" / ", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 4.dp))
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                ),
                actions = {
                    IconButton(onClick = { navController.navigate("transfers") }) {
                        Icon(Icons.Default.SwapVert, contentDescription = "Transfers")
                    }
                    IconButton(onClick = { navController.navigate("settings") }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                    IconButton(onClick = { viewModel.fetchFiles() }) {
                        Icon(androidx.compose.material.icons.Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { launcher.launch("*/*") },
                containerColor = AetherPrimary,
                contentColor = Color.White
            ) {
                Text("+", modifier = Modifier.padding(horizontal = 16.dp), fontWeight = FontWeight.ExtraBold)
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (isLoading && items.isEmpty()) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else if (error != null && items.isEmpty()) {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Failed to connect to node", color = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = { viewModel.fetchFiles() }) {
                        Text("Retry")
                    }
                }
            } else if (items.isEmpty()) {
                Text("This folder is empty.", modifier = Modifier.align(Alignment.Center), color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item { Spacer(modifier = Modifier.height(8.dp)) }
                    items(items) { item ->
                        when (item) {
                            is AetherItem.Folder -> FolderRow(item) {
                                viewModel.navigateToFolder(item.id, item.name)
                            }
                            is AetherItem.File -> FileRow(item) {
                                if (item.isVideo) {
                                    promptTitle = "Stream Video"
                                    promptMessage = "Enter volume passphrase to decrypt this video on the fly."
                                    pendingAction = { masterKey: ByteArray ->
                                        viewModel.setStreamContext(
                                            file = item,
                                            masterKey = masterKey,
                                            kdfSalt = android.util.Base64.decode(volume?.kdfSalt ?: "", android.util.Base64.DEFAULT)
                                        )
                                        navController.navigate("video/${item.id}/${Uri.encode(item.name)}")
                                    }
                                } else {
                                    promptTitle = "Download File"
                                    promptMessage = "Enter volume passphrase to decrypt and download ${item.name}."
                                    pendingAction = { masterKey: ByteArray ->
                                        val masterKeyB64 = android.util.Base64.encodeToString(masterKey, android.util.Base64.DEFAULT)
                                        val request = OneTimeWorkRequestBuilder<com.aetheros.worker.DownloadWorker>()
                                            .setInputData(workDataOf(
                                                "FILE_ID" to item.id,
                                                "MASTER_KEY" to masterKeyB64,
                                                "VOLUME_ID" to volumeId
                                            ))
                                            .addTag("transfer")
                                            .build()
                                        WorkManager.getInstance(context).enqueue(request)
                                        android.widget.Toast.makeText(context, "Downloading...", android.widget.Toast.LENGTH_SHORT).show()
                                    }
                                }
                            }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(88.dp)) } // Padding for FAB
                }
            }
        }
    }
}

@Composable
fun FolderRow(folder: AetherItem.Folder, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha=0.3f))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(AetherPrimary.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Folder, contentDescription = null, tint = AetherPrimary)
        }
        Spacer(modifier = Modifier.width(16.dp))
        Text(folder.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun FileRow(file: AetherItem.File, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Brush.linearGradient(listOf(AetherPrimary.copy(alpha=0.2f), AetherSecondary.copy(alpha=0.2f)))),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (file.isVideo) Icons.Default.VideoFile else Icons.AutoMirrored.Filled.InsertDriveFile,
                contentDescription = null,
                tint = AetherPrimary
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(file.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            Text(file.size, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
