package com.example.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesomeMotion
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.VideoFile
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.data.UiState
import com.example.model.StatusMediaType
import com.example.model.StatusUpdate
import com.example.ui.components.AvatarCircle
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.viewmodel.ConnectXViewModel

@Composable
fun StatusTabContent(
    viewModel: ConnectXViewModel,
    workspaceState: UiState<List<StatusUpdate>>,
    myState: UiState<List<StatusUpdate>>,
    showCreateDialog: Boolean,
    onDismissCreate: () -> Unit,
    onOpenCreate: () -> Unit,
) {
    var showMineOnly by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !showMineOnly, onClick = { showMineOnly = false }, label = { Text("Workspace Feed") })
            FilterChip(selected = showMineOnly, onClick = { showMineOnly = true }, label = { Text("My Updates") })
        }
        Spacer(Modifier.height(8.dp))

        val active = if (showMineOnly) myState else workspaceState
        when (active) {
            is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            is UiState.Error -> ConnectXErrorBanner(active.message)
            is UiState.Success -> {
                if (active.data.isEmpty()) {
                    ConnectXEmptyState(
                        icon = Icons.Filled.AutoAwesomeMotion,
                        title = "No status updates yet",
                        subtitle = "Share text, image, or video updates with workspace or private visibility.",
                        actionLabel = "Post Status",
                        onAction = onOpenCreate,
                    )
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(active.data, key = { it.id }) { st ->
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                        AvatarCircle(name = st.authorName, size = 38.dp)
                                        Spacer(Modifier.width(10.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(st.authorName, style = MaterialTheme.typography.titleSmall)
                                            Text(formatTimestamp(st.createdAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        }
                                        StatusPill(st.visibility, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(st.text, style = MaterialTheme.typography.bodyLarge)
                                    if (st.mediaNote != null) {
                                        Spacer(Modifier.height(6.dp))
                                        StatusPill(
                                            text = "${st.parsedMediaType.label}: ${st.mediaNote}",
                                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
                                        )
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        TextButton(onClick = { viewModel.reactToStatus(st.id) }) {
                                            Icon(Icons.Filled.Favorite, contentDescription = "React", modifier = Modifier.size(16.dp))
                                            Spacer(Modifier.width(4.dp))
                                            Text("${st.reactionsCount}")
                                        }
                                        if (st.authorId == viewModel.currentUserId) {
                                            IconButton(onClick = { viewModel.deleteStatus(st.id) }) {
                                                Icon(Icons.Filled.Delete, contentDescription = "Delete status")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        var text by remember { mutableStateOf("") }
        var mediaType by remember { mutableStateOf(StatusMediaType.TEXT) }
        var mediaNote by remember { mutableStateOf<String?>(null) }
        var visibility by remember { mutableStateOf("WORKSPACE") }

        val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri != null) {
                mediaType = StatusMediaType.IMAGE
                mediaNote = "Image (${uri.lastPathSegment ?: "photo"})"
            }
        }
        val videoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri != null) {
                mediaType = StatusMediaType.VIDEO
                mediaNote = "Video (${uri.lastPathSegment ?: "clip"})"
            }
        }

        AlertDialog(
            onDismissRequest = onDismissCreate,
            title = { Text("Post Status Update") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = text,
                        onValueChange = { text = it },
                        label = { Text("What's happening?") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = {
                            imagePicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        }) {
                            Icon(Icons.Filled.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Image")
                        }
                        OutlinedButton(onClick = {
                            videoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly))
                        }) {
                            Icon(Icons.Filled.VideoFile, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Video")
                        }
                    }
                    if (mediaNote != null) {
                        Text("Attached: $mediaNote", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(selected = visibility == "WORKSPACE", onClick = { visibility = "WORKSPACE" }, label = { Text("Workspace") })
                        FilterChip(selected = visibility == "PRIVATE", onClick = { visibility = "PRIVATE" }, label = { Text("Private") })
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.createStatus(text, mediaType, mediaNote, visibility)
                        onDismissCreate()
                    },
                    enabled = text.isNotBlank(),
                ) { Text("Publish") }
            },
            dismissButton = { TextButton(onClick = onDismissCreate) { Text("Cancel") } },
        )
    }
}
