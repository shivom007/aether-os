package com.aetheros.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = AetherPrimary,
    secondary = AetherSecondary,
    background = AetherBackground,
    surface = AetherSurface,
    surfaceVariant = AetherSurfaceVariant,
    onPrimary = AetherTextPrimary,
    onSecondary = AetherTextPrimary,
    onBackground = AetherTextPrimary,
    onSurface = AetherTextPrimary,
    onSurfaceVariant = AetherTextSecondary,
    error = AetherError
)

@Composable
fun AetherOSTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
