package com.aetheros

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.aetheros.ui.screens.LoginScreen
import com.aetheros.ui.screens.FileBrowserScreen
import com.aetheros.ui.theme.AetherOSTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AetherOSTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AetherAppNavigation()
                }
            }
        }
    }
}

@Composable
fun AetherAppNavigation() {
    val navController = rememberNavController()
    
    NavHost(navController = navController, startDestination = "login") {
        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("volumes") {
                        popUpTo("login") { inclusive = true }
                    }
                }
            )
        }
        composable("volumes") {
            com.aetheros.ui.screens.VolumesScreen(navController = navController)
        }
        composable(
            route = "browser/{volumeId}",
            arguments = listOf(
                androidx.navigation.navArgument("volumeId") { type = androidx.navigation.NavType.StringType }
            )
        ) { backStackEntry ->
            val volumeId = backStackEntry.arguments?.getString("volumeId") ?: return@composable
            FileBrowserScreen(volumeId = volumeId, navController = navController)
        }
        composable("settings") {
            com.aetheros.ui.screens.SettingsScreen()
        }
        composable("transfers") {
            com.aetheros.ui.screens.TransfersScreen(navController = navController)
        }
        composable(
            route = "video/{fileId}/{fileName}",
            arguments = listOf(
                androidx.navigation.navArgument("fileId") { type = androidx.navigation.NavType.LongType },
                androidx.navigation.navArgument("fileName") { type = androidx.navigation.NavType.StringType }
            )
        ) { backStackEntry ->
            val fileId = backStackEntry.arguments?.getLong("fileId") ?: return@composable
            val fileName = backStackEntry.arguments?.getString("fileName") ?: return@composable
            com.aetheros.ui.screens.VideoPlayerScreen(
                fileId = fileId,
                fileName = fileName,
                navController = navController
            )
        }
    }
}

@Composable
fun AetherOSTheme(content: @Composable () -> Unit) {
    val colorScheme = darkColorScheme(
        primary = androidx.compose.ui.graphics.Color(0xFF6200EE),
        secondary = androidx.compose.ui.graphics.Color(0xFF03DAC5),
        background = androidx.compose.ui.graphics.Color(0xFF121212),
        surface = androidx.compose.ui.graphics.Color(0xFF1E1E1E)
    )

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
