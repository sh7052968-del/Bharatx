package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Campaign
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.UiState
import com.example.model.BroadcastChannel
import com.example.model.ChannelCategory
import com.example.model.ChannelPost
import com.example.model.UserRole
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.viewmodel.ConnectXViewModel

@Composable
fun ChannelsScreen(
    viewModel: ConnectXViewModel,
    modifier: Modifier = Modifier,
    showTopBar: Boolean = true,
) {
    val workspaceChannelsState by viewModel.workspaceChannels.collectAsStateWithLifecycle()
    val myChannelsState by viewModel.myChannels.collectAsStateWithLifecycle()
    val selectedChannelId by viewModel.selectedChannelId.collectAsStateWithLifecycle()
    val postsState by viewModel.activeChannelPosts.collectAsStateWithLifecycle()
    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()

    var showCreateChannel by remember { mutableStateOf(false) }

    val allChannels = remember(workspaceChannelsState, myChannelsState) {
        val ws = (workspaceChannelsState as? UiState.Success)?.data ?: emptyList()
        val mine = (myChannelsState as? UiState.Success)?.data ?: emptyList()
        (mine + ws).distinctBy { it.id }
    }
    val selectedChannel = allChannels.firstOrNull { it.id == selectedChannelId }
    val userRole = (profileState as? UiState.Success)?.data?.parsedRole ?: UserRole.MEMBER

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val isWide = maxWidth >= 840.dp
        if (isWide) {
            Row(modifier = Modifier.fillMaxSize()) {
                ChannelListPane(
                    workspaceState = workspaceChannelsState,
                    myState = myChannelsState,
                    currentUserId = viewModel.currentUserId,
                    showTopBar = showTopBar,
                    onSelect = { viewModel.selectChannel(it) },
                    onToggleMembership = { viewModel.toggleChannelMembership(it) },
                    onNewChannel = { showCreateChannel = true },
                    modifier = Modifier.width(370.dp).fillMaxHeight(),
                )
                HorizontalDivider(modifier = Modifier.width(1.dp).fillMaxHeight())
                if (selectedChannel != null) {
                    ChannelDetailPane(
                        channel = selectedChannel,
                        postsState = postsState,
                        currentUserId = viewModel.currentUserId,
                        userRole = userRole,
                        onBack = null,
                        onPublishPost = { title, body, pinned ->
                            viewModel.createChannelPost(selectedChannel, title, body, pinned)
                        },
                        onAcknowledge = { postId ->
                            viewModel.acknowledgePost(selectedChannel.id, postId)
                        },
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                    )
                } else {
                    Box(modifier = Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
                        ConnectXEmptyState(
                            icon = Icons.Filled.Campaign,
                            title = "Select a Broadcast Channel",
                            subtitle = "Follow workspace announcements, engineering updates, and team communities.",
                            actionLabel = "Create Channel",
                            onAction = { showCreateChannel = true },
                        )
                    }
                }
            }
        } else {
            if (selectedChannel != null) {
                BackHandler { viewModel.selectChannel(null) }
                ChannelDetailPane(
                    channel = selectedChannel,
                    postsState = postsState,
                    currentUserId = viewModel.currentUserId,
                    userRole = userRole,
                    onBack = { viewModel.selectChannel(null) },
                    onPublishPost = { title, body, pinned ->
                        viewModel.createChannelPost(selectedChannel, title, body, pinned)
                    },
                    onAcknowledge = { postId ->
                        viewModel.acknowledgePost(selectedChannel.id, postId)
                    },
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                ChannelListPane(
                    workspaceState = workspaceChannelsState,
                    myState = myChannelsState,
                    currentUserId = viewModel.currentUserId,
                    showTopBar = showTopBar,
                    onSelect = { viewModel.selectChannel(it) },
                    onToggleMembership = { viewModel.toggleChannelMembership(it) },
                    onNewChannel = { showCreateChannel = true },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }

    if (showCreateChannel) {
        CreateChannelDialog(
            onDismiss = { showCreateChannel = false },
            onCreate = { name, desc, cat, vis ->
                viewModel.createChannel(name, desc, cat, vis)
                showCreateChannel = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChannelListPane(
    workspaceState: UiState<List<BroadcastChannel>>,
    myState: UiState<List<BroadcastChannel>>,
    currentUserId: String,
    showTopBar: Boolean,
    onSelect: (BroadcastChannel) -> Unit,
    onToggleMembership: (BroadcastChannel) -> Unit,
    onNewChannel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var showJoinedOnly by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = if (showTopBar) androidx.compose.material3.ScaffoldDefaults.contentWindowInsets else androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
        topBar = {
            if (showTopBar) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Channels", style = MaterialTheme.typography.titleLarge)
                            Text(
                                "Broadcast Feeds & Communities",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNewChannel,
                modifier = Modifier.testTag("new_channel_fab"),
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Filled.Add, contentDescription = "Create Broadcast Channel")
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            Image(
                painter = painterResource(id = R.drawable.img_channel_cover_1795598983450),
                contentDescription = "Broadcast channels banner",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
                    .clip(MaterialTheme.shapes.medium),
                contentScale = ContentScale.Crop,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = !showJoinedOnly,
                    onClick = { showJoinedOnly = false },
                    label = { Text("Discover Workspace") },
                )
                FilterChip(
                    selected = showJoinedOnly,
                    onClick = { showJoinedOnly = true },
                    label = { Text("My Channels") },
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            val activeState = if (showJoinedOnly) myState else workspaceState
            when (activeState) {
                is UiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                is UiState.Error -> ConnectXErrorBanner(message = activeState.message)
                is UiState.Success -> {
                    if (activeState.data.isEmpty()) {
                        ConnectXEmptyState(
                            icon = Icons.Filled.Campaign,
                            title = "No channels published",
                            subtitle = "Create a workspace or private broadcast channel for structured updates.",
                            actionLabel = "Create Channel",
                            onAction = onNewChannel,
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(bottom = 88.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            items(activeState.data, key = { it.id }) { channel ->
                                val isJoined = currentUserId in channel.memberUids
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onSelect(channel) }
                                        .testTag("channel_card_${channel.id}"),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                                    ),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                                ) {
                                    Column(modifier = Modifier.padding(14.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Text(
                                                text = channel.name,
                                                style = MaterialTheme.typography.titleMedium,
                                                modifier = Modifier.weight(1f),
                                            )
                                            StatusPill(
                                                text = channel.visibility,
                                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                                                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                            )
                                        }
                                        if (channel.description.isNotBlank()) {
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = channel.description,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                        Spacer(modifier = Modifier.height(10.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Text(
                                                text = "${channel.parsedCategory.label} • ${channel.followerCount} members",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                            if (channel.ownerId != currentUserId) {
                                                OutlinedButton(
                                                    onClick = { onToggleMembership(channel) },
                                                    modifier = Modifier.testTag("join_channel_button_${channel.id}"),
                                                ) {
                                                    Text(if (isJoined) "Joined" else "Join")
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
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChannelDetailPane(
    channel: BroadcastChannel,
    postsState: UiState<List<ChannelPost>>,
    currentUserId: String,
    userRole: UserRole,
    onBack: (() -> Unit)?,
    onPublishPost: (String, String, Boolean) -> Unit,
    onAcknowledge: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var showComposer by remember { mutableStateOf(false) }
    var showGroupInfo by remember { mutableStateOf(false) }
    val canPost = channel.ownerId == currentUserId || userRole == UserRole.ADMIN

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack, modifier = Modifier.testTag("channel_back_button")) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                title = {
                    Column {
                        Text(channel.name, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "${channel.parsedCategory.label} • Owner: ${channel.ownerName} • ${channel.followerCount} members",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    TextButton(onClick = { showGroupInfo = true }) {
                        Text("Info")
                    }
                },
            )
        },
        floatingActionButton = {
            if (canPost) {
                FloatingActionButton(
                    onClick = { showComposer = true },
                    modifier = Modifier.testTag("new_channel_post_fab"),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Publish Announcement")
                }
            }
        },
    ) { padding ->
        when (postsState) {
            is UiState.Loading -> {
                Box(modifier = Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            is UiState.Error -> {
                ConnectXErrorBanner(message = postsState.message, modifier = Modifier.padding(padding).padding(16.dp))
            }
            is UiState.Success -> {
                if (postsState.data.isEmpty()) {
                    ConnectXEmptyState(
                        icon = Icons.Filled.Campaign,
                        title = "No announcements yet",
                        subtitle = if (canPost) "Publish the first pinned announcement to this channel." else "Channel owner has not posted announcements yet.",
                        actionLabel = if (canPost) "Publish Post" else null,
                        onAction = if (canPost) { { showComposer = true } } else null,
                        modifier = Modifier.padding(padding),
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(postsState.data, key = { it.id }) { post ->
                            Card(
                                colors = CardDefaults.cardColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                                ),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Text(
                                            text = post.title,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier.weight(1f),
                                        )
                                        if (post.pinned) {
                                            Icon(
                                                imageVector = Icons.Filled.PushPin,
                                                contentDescription = "Pinned post",
                                                tint = MaterialTheme.colorScheme.secondary,
                                                modifier = Modifier.size(18.dp),
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(text = post.body, style = MaterialTheme.typography.bodyLarge)
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Text(
                                            text = "${post.authorName} • ${formatTimestamp(post.createdAt)}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                        TextButton(
                                            onClick = { onAcknowledge(post.id) },
                                            modifier = Modifier.testTag("ack_post_button_${post.id}"),
                                        ) {
                                            Icon(Icons.Filled.ThumbUp, contentDescription = "Acknowledge", modifier = Modifier.size(16.dp))
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("${post.likesCount}")
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

    if (showComposer) {
        var title by remember { mutableStateOf("") }
        var body by remember { mutableStateOf("") }
        var pinned by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { showComposer = false },
            title = { Text("Publish Announcement") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Headline") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = body,
                        onValueChange = { body = it },
                        label = { Text("Announcement Details") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = pinned, onCheckedChange = { pinned = it })
                        Text("Pin to top of channel", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onPublishPost(title, body, pinned)
                        showComposer = false
                    },
                    enabled = title.isNotBlank() && body.isNotBlank(),
                ) {
                    Text("Publish")
                }
            },
            dismissButton = {
                TextButton(onClick = { showComposer = false }) { Text("Cancel") }
            },
        )
    }

    if (showGroupInfo) {
        AlertDialog(
            onDismissRequest = { showGroupInfo = false },
            title = { Text("${channel.name} • Info") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (channel.description.isNotBlank()) {
                        Text(channel.description, style = MaterialTheme.typography.bodyMedium)
                    }
                    Text("Visibility: ${channel.visibility}", style = MaterialTheme.typography.labelMedium)
                    Text("Category: ${channel.parsedCategory.label}", style = MaterialTheme.typography.labelMedium)
                    Text("Owner & Moderator: ${channel.ownerName}", style = MaterialTheme.typography.labelMedium)
                    Text("Permissions: Owner & Workspace Admins may publish pinned announcements. Members may read & acknowledge.", style = MaterialTheme.typography.bodySmall)
                    Text("Members (${channel.memberUids.size}):", style = MaterialTheme.typography.labelMedium)
                    channel.memberUids.take(8).forEach { uid ->
                        Text(
                            text = if (uid == currentUserId) "• You ($uid)" else "• $uid",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showGroupInfo = false }) { Text("Close") }
            },
        )
    }
}

@Composable
private fun CreateChannelDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String, ChannelCategory, String) -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(ChannelCategory.ANNOUNCEMENTS) }
    var visibility by remember { mutableStateOf("WORKSPACE") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Broadcast Channel") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Channel Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("new_channel_name_input"),
                )
                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Purpose / Guidelines") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text("Category", style = MaterialTheme.typography.labelMedium)
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ChannelCategory.entries.forEach { c ->
                        FilterChip(selected = category == c, onClick = { category = c }, label = { Text(c.label) })
                    }
                }
                Text("Visibility", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = visibility == "WORKSPACE",
                        onClick = { visibility = "WORKSPACE" },
                        label = { Text("Workspace") },
                    )
                    FilterChip(
                        selected = visibility == "PRIVATE",
                        onClick = { visibility = "PRIVATE" },
                        label = { Text("Private") },
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onCreate(name, description, category, visibility) },
                enabled = name.trim().length >= 2,
                modifier = Modifier.testTag("confirm_create_channel_button"),
            ) {
                Text("Create")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
