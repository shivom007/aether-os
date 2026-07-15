package com.aetheros.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.aetheros.ui.theme.AetherPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransfersScreen(navController: NavController) {
    val context = LocalContext.current
    val workInfos by WorkManager.getInstance(context).getWorkInfosByTagFlow("transfer").collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Active Transfers", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (workInfos.isEmpty()) {
                Text(
                    "No active or recent transfers.",
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(workInfos) { workInfo ->
                        TransferRow(workInfo)
                    }
                }
            }
        }
    }
}

@Composable
fun TransferRow(workInfo: WorkInfo) {
    val progress = workInfo.progress.getInt("PROGRESS", 0)
    val fileName = workInfo.progress.getString("FILENAME") ?: "Unknown File"
    val type = workInfo.progress.getString("TYPE") ?: "TRANSFER"
    
    val stateText = when (workInfo.state) {
        WorkInfo.State.ENQUEUED -> "Pending..."
        WorkInfo.State.RUNNING -> "$progress%"
        WorkInfo.State.SUCCEEDED -> "Completed"
        WorkInfo.State.FAILED -> "Failed"
        WorkInfo.State.BLOCKED -> "Blocked"
        WorkInfo.State.CANCELLED -> "Cancelled"
    }

    val icon = if (type == "UPLOAD") Icons.Default.Upload else Icons.Default.Download

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
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
            Icon(icon, contentDescription = null, tint = AetherPrimary)
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(fileName, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
            Spacer(modifier = Modifier.height(4.dp))
            
            if (workInfo.state == WorkInfo.State.RUNNING || workInfo.state == WorkInfo.State.ENQUEUED) {
                LinearProgressIndicator(
                    progress = { if (progress > 0) progress / 100f else 0f },
                    modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)),
                    color = AetherPrimary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Spacer(modifier = Modifier.height(4.dp))
            }
            Text(
                stateText,
                style = MaterialTheme.typography.bodySmall,
                color = if (workInfo.state == WorkInfo.State.FAILED) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
