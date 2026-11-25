package com.example.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.AddComment
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.UiState
import com.example.model.Conversation
import com.example.model.ConversationType
import com.example.model.DeterministicRulesEngine
import com.example.model.DirectoryMember
import com.example.model.PriorityLevel
import com.example.model.UserRole
import com.example.ui.components.AvatarCircle
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.ConversationStatusBadge
import com.example.ui.components.PriorityBadge
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.ui.i18n.LocalConnectXStrings
import com.example.viewmodel.ConnectXViewModel

@Composable
fun ChatsScreen(
    viewModel: ConnectXViewModel,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    val conversationsState by viewModel.conversations.collectAsStateWithLifecycle()
    val directoryState by viewModel.directoryMembers.collectAsStateWithLifecycle()
    val selectedId by viewModel.selectedConversationId.collectAsStateWithLifecycle()
    val messagesState by viewModel.activeMessages.collectAsStateWithLifecycle()
    val quickRepliesState by viewModel.quickReplies.collectAsStateWithLifecycle()
    val catalogState by viewModel.publicCatalog.collectAsStateWithLifecycle()
    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()

    var showCreateDialog by remember { mutableStateOf(false) }

    val conversations = (conversationsState as? UiState.Success)?.data ?: emptyList()
    val selectedConversation = conversations.firstOrNull { it.id == selectedId }
    val userRole = (profileState as? UiState.Success)?.data?.parsedRole ?: UserRole.MEMBER
    val quickReplies = (quickRepliesState as? UiState.Success)?.data ?: emptyList()
    val catalogItems = (catalogState as? UiState.Success)?.data ?: emptyList()

    BoxWithConstraints(modifier = modifier.fillMaxSize()) {
        val isWide = maxWidth >= 840.dp
        if (isWide) {
            Row(modifier = Modifier.fillMaxSize()) {
                ConversationListPane(
                    state = conversationsState,
                    currentUserId = viewModel.currentUserId,
                    selectedId = selectedId,
                    onSelect = { viewModel.selectConversation(it.id) },
                    onNewConversation = { showCreateDialog = true },
                    modifier = Modifier.width(360.dp).fillMaxHeight(),
                )
                HorizontalDivider(modifier = Modifier.width(1.dp).fillMaxHeight())
                if (selectedConversation != null) {
                    ChatDetailPane(
                        viewModel = viewModel,
                        conversation = selectedConversation,
                        allConversations = conversations,
                        messagesState = messagesState,
                        userRole = userRole,
                        quickReplies = quickReplies,
                        catalogItems = catalogItems,
                        onBack = null,
                        modifier = Modifier.weight(1f).fillMaxHeight(),
                    )
                } else {
                    Box(modifier = Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.Center) {
                        ConnectXEmptyState(
                            icon = Icons.AutoMirrored.Filled.Chat,
                            title = "Select a thread",
                            subtitle = "Choose a direct message, team group, or support desk thread to start collaborating.",
                            actionLabel = strings.newConversation,
                            onAction = { showCreateDialog = true },
                        )
                    }
                }
            }
        } else {
            if (selectedConversation != null) {
                BackHandler { viewModel.selectConversation(null) }
                ChatDetailPane(
                    viewModel = viewModel,
                    conversation = selectedConversation,
                    allConversations = conversations,
                    messagesState = messagesState,
                    userRole = userRole,
                    quickReplies = quickReplies,
                    catalogItems = catalogItems,
                    onBack = { viewModel.selectConversation(null) },
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                ConversationListPane(
                    state = conversationsState,
                    currentUserId = viewModel.currentUserId,
                    selectedId = selectedId,
                    onSelect = { viewModel.selectConversation(it.id) },
                    onNewConversation = { showCreateDialog = true },
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }

    if (showCreateDialog) {
        CreateConversationDialog(
            members = (directoryState as? UiState.Success)?.data ?: emptyList(),
            currentUserId = viewModel.currentUserId,
            onDismiss = { showCreateDialog = false },
            onCreate = { title, type, members, initialMsg, labels ->
                viewModel.createConversation(title, type, members, initialMsg, labels)
                showCreateDialog = false
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConversationListPane(
    state: UiState<List<Conversation>>,
    currentUserId: String,
    selectedId: String?,
    onSelect: (Conversation) -> Unit,
    onNewConversation: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    var searchQuery by remember { mutableStateOf("") }
    var filterType by remember { mutableStateOf<ConversationType?>(null) }
    var showArchived by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(strings.messagesTitle, style = MaterialTheme.typography.titleLarge)
                        Text(
                            strings.messagesSubtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onNewConversation,
                modifier = Modifier.testTag("new_conversation_fab"),
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            ) {
                Icon(Icons.Filled.AddComment, contentDescription = strings.newConversation)
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search threads or labels") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = "Search") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().testTag("conversation_search_input"),
                shape = MaterialTheme.shapes.medium,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    selected = !showArchived,
                    onClick = { showArchived = false },
                    label = { Text(strings.activeThreads) },
                )
                FilterChip(
                    selected = showArchived,
                    onClick = { showArchived = true },
                    label = { Text(strings.archivedThreads) },
                )
                FilterChip(
                    selected = filterType == null,
                    onClick = { filterType = null },
                    label = { Text("All") },
                )
                ConversationType.entries.forEach { type ->
                    FilterChip(
                        selected = filterType == type,
                        onClick = { filterType = if (filterType == type) null else type },
                        label = { Text(type.label) },
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            when (state) {
                is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
                is UiState.Error -> ConnectXErrorBanner(message = state.message, modifier = Modifier.padding(top = 12.dp))
                is UiState.Success -> {
                    val filtered = state.data.filter { conv ->
                        val isArchived = currentUserId in conv.archivedByUids
                        val matchesArchive = if (showArchived) isArchived else !isArchived
                        val matchesType = filterType == null || conv.parsedType == filterType
                        val q = searchQuery.trim().lowercase()
                        val matchesQuery = q.isEmpty() ||
                            conv.title.lowercase().contains(q) ||
                            conv.lastMessageText.lowercase().contains(q) ||
                            conv.labels.any { it.lowercase().contains(q) }
                        matchesArchive && matchesType && matchesQuery
                    }
                    if (filtered.isEmpty()) {
                        ConnectXEmptyState(
                            icon = Icons.AutoMirrored.Filled.Chat,
                            title = if (showArchived) "No archived threads" else "No conversations yet",
                            subtitle = if (showArchived) "Archived threads appear here cleanly." else "Start a direct chat, team group, or deterministic SLA support thread.",
                            actionLabel = if (showArchived) null else strings.newConversation,
                            onAction = if (showArchived) null else onNewConversation,
                        )
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(bottom = 88.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            items(filtered, key = { it.id }) { conv ->
                                ConversationCard(
                                    conversation = conv,
                                    isMuted = currentUserId in conv.mutedByUids,
                                    isSelected = conv.id == selectedId,
                                    onClick = { onSelect(conv) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationCard(
    conversation: Conversation,
    isMuted: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).testTag("conversation_card_${conversation.id}"),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
            else MaterialTheme.colorScheme.surfaceContainerLowest,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isSelected) 2.dp else 1.dp),
    ) {
        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            AvatarCircle(name = conversation.title, size = 46.dp)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = conversation.title,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    if (isMuted) {
                        Icon(Icons.Filled.NotificationsOff, contentDescription = "Muted", modifier = Modifier.padding(end = 4.dp))
                    }
                    Text(
                        text = formatTimestamp(conversation.lastMessageAt ?: conversation.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = conversation.lastMessageText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                ) {
                    StatusPill(
                        text = conversation.parsedType.label.uppercase(),
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                        contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    ConversationStatusBadge(conversation.parsedStatus)
                    if (conversation.parsedType == ConversationType.SUPPORT || conversation.parsedPriority != PriorityLevel.NORMAL) {
                        PriorityBadge(conversation.parsedPriority)
                    }
                    conversation.labels.forEach { tag ->
                        StatusPill(
                            text = "#$tag",
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CreateConversationDialog(
    members: List<DirectoryMember>,
    currentUserId: String,
    onDismiss: () -> Unit,
    onCreate: (String, ConversationType, List<String>, String, List<String>) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var initialMsg by remember { mutableStateOf("") }
    var labelsText by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf(ConversationType.DIRECT) }
    val selectedMembers = remember { mutableStateListOf<String>() }
    val otherMembers = members.filter { it.userId != currentUserId }

    val predictedPriority = remember(title, initialMsg, selectedType) {
        if (selectedType == ConversationType.SUPPORT) {
            DeterministicRulesEngine.classifySupportPriority(title, initialMsg)
        } else PriorityLevel.NORMAL
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Start New Thread") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ConversationType.entries.forEach { t ->
                        FilterChip(selected = selectedType == t, onClick = { selectedType = t }, label = { Text(t.label) })
                    }
                }
                OutlinedTextField(
                    value = title, onValueChange = { title = it },
                    label = { Text("Thread Subject / Name") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("new_thread_title_input"),
                )
                OutlinedTextField(
                    value = initialMsg, onValueChange = { initialMsg = it },
                    label = { Text("Opening Message") }, minLines = 2,
                    modifier = Modifier.fillMaxWidth().testTag("new_thread_message_input"),
                )
                OutlinedTextField(
                    value = labelsText, onValueChange = { labelsText = it },
                    label = { Text("Labels (comma-separated, optional)") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (selectedType == ConversationType.SUPPORT) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Deterministic SLA Priority: ", style = MaterialTheme.typography.labelMedium)
                        PriorityBadge(predictedPriority)
                    }
                }
                if (otherMembers.isNotEmpty()) {
                    Text("Add Workspace Members:", style = MaterialTheme.typography.labelMedium)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        otherMembers.take(5).forEach { member ->
                            val picked = member.userId in selectedMembers
                            FilterChip(
                                selected = picked,
                                onClick = {
                                    if (picked) selectedMembers.remove(member.userId)
                                    else selectedMembers.add(member.userId)
                                },
                                label = { Text("${member.displayName} (@${member.handle})") },
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            OutlinedButton(
                onClick = {
                    val labels = labelsText.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                    onCreate(title, selectedType, selectedMembers.toList(), initialMsg, labels)
                },
                enabled = title.isNotBlank() && initialMsg.isNotBlank(),
                modifier = Modifier.testTag("confirm_create_thread_button"),
            ) {
                Text("Create")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
