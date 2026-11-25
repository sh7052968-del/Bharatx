package com.example.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.InsertEmoticon
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.data.UiState
import com.example.model.CatalogItem
import com.example.model.ChatMessage
import com.example.model.Conversation
import com.example.model.ConversationStatus
import com.example.model.DeterministicRulesEngine
import com.example.model.MessageType
import com.example.model.PriorityLevel
import com.example.model.QuickReply
import com.example.model.UserRole
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.ConversationStatusBadge
import com.example.ui.components.PriorityBadge
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.ui.i18n.LocalConnectXStrings
import com.example.viewmodel.ConnectXViewModel
import kotlinx.coroutines.delay
import java.io.File

private val QUICK_EMOJIS = listOf("👍", "❤️", "😂", "🎉", "✅", "🙏")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatDetailPane(
    viewModel: ConnectXViewModel,
    conversation: Conversation,
    allConversations: List<Conversation>,
    messagesState: UiState<List<ChatMessage>>,
    userRole: UserRole,
    quickReplies: List<QuickReply>,
    catalogItems: List<CatalogItem>,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    val context = LocalContext.current
    val currentUserId = viewModel.currentUserId

    var draft by remember(conversation.id) { mutableStateOf("") }
    var attachedNote by remember(conversation.id) { mutableStateOf<String?>(null) }
    var attachedFileMode by remember(conversation.id) { mutableStateOf(false) }
    var replyTarget by remember(conversation.id) { mutableStateOf<ChatMessage?>(null) }
    var showEmojiBar by remember(conversation.id) { mutableStateOf(false) }
    var showSearchBar by remember(conversation.id) { mutableStateOf(false) }
    var msgSearchQuery by remember(conversation.id) { mutableStateOf("") }

    var showWorkflowDialog by remember { mutableStateOf(false) }
    var showDisappearingDialog by remember { mutableStateOf(false) }
    var showOrderCardPicker by remember { mutableStateOf(false) }
    var showOverflowMenu by remember { mutableStateOf(false) }
    var selectedMessageForAction by remember { mutableStateOf<ChatMessage?>(null) }
    var editTarget by remember { mutableStateOf<ChatMessage?>(null) }
    var forwardTarget by remember { mutableStateOf<ChatMessage?>(null) }

    var isRecordingVoice by remember(conversation.id) { mutableStateOf(false) }
    var voiceSeconds by remember(conversation.id) { mutableLongStateOf(0L) }
    var activeRecorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var micNotice by remember { mutableStateOf<String?>(null) }

    val listState = rememberLazyListState()

    val startVoiceRecording: () -> Unit = {
        val cacheFile = File(context.cacheDir, "cx_voice_${System.currentTimeMillis()}.m4a")
        val rec = try {
            val mr = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
            mr.setAudioSource(MediaRecorder.AudioSource.MIC)
            mr.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mr.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mr.setOutputFile(cacheFile.absolutePath)
            mr.prepare()
            mr.start()
            mr
        } catch (_: Exception) {
            null
        }
        activeRecorder = rec
        voiceSeconds = 1L
        isRecordingVoice = true
        micNotice = null
    }

    val stopAndSendVoice: (Boolean) -> Unit = { send ->
        try {
            activeRecorder?.stop()
        } catch (_: Exception) {
        }
        try {
            activeRecorder?.release()
        } catch (_: Exception) {
        }
        activeRecorder = null
        val duration = voiceSeconds.coerceIn(1L, 600L)
        isRecordingVoice = false
        voiceSeconds = 0L
        if (send) {
            viewModel.sendMessage(
                conversation = conversation,
                body = "Voice message (${DeterministicRulesEngine.formatDuration(duration)})",
                messageType = MessageType.VOICE,
                voiceDurationSec = duration,
                replyPreview = replyTarget?.let { "${it.senderName}: ${it.body.take(80)}" },
            )
            replyTarget = null
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            try { activeRecorder?.release() } catch (_: Exception) {}
        }
    }

    LaunchedEffect(isRecordingVoice) {
        while (isRecordingVoice) {
            delay(1000L)
            voiceSeconds += 1L
        }
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) startVoiceRecording()
        else micNotice = "Microphone permission is required to record voice notes."
    }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            attachedFileMode = false
            attachedNote = "Photo (${uri.lastPathSegment ?: "media"})"
        }
    }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            attachedFileMode = true
            attachedNote = "Document (${uri.lastPathSegment ?: "file"})"
        }
    }

    val isLocked = conversation.parsedStatus == ConversationStatus.RESOLVED && userRole != UserRole.ADMIN
    val canManageWorkflow = conversation.ownerId == currentUserId || DeterministicRulesEngine.canManageTickets(userRole)
    val isArchived = currentUserId in conversation.archivedByUids
    val isMuted = currentUserId in conversation.mutedByUids

    Scaffold(
        modifier = modifier.imePadding(),
        topBar = {
            TopAppBar(
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack, modifier = Modifier.testTag("chat_back_button")) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    }
                },
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                text = conversation.title,
                                style = MaterialTheme.typography.titleMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f, fill = false),
                            )
                            if (isMuted) Icon(Icons.Filled.NotificationsOff, contentDescription = "Muted", modifier = Modifier.size(16.dp))
                            if (conversation.disappearingHours > 0L) {
                                StatusPill("${conversation.disappearingHours}h", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            ConversationStatusBadge(conversation.parsedStatus)
                            PriorityBadge(conversation.parsedPriority)
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { showSearchBar = !showSearchBar }, modifier = Modifier.testTag("chat_search_toggle")) {
                        Icon(Icons.Filled.Search, contentDescription = strings.searchMessages)
                    }
                    Box {
                        IconButton(onClick = { showOverflowMenu = true }, modifier = Modifier.testTag("chat_options_button")) {
                            Icon(Icons.Filled.Tune, contentDescription = "Thread Options")
                        }
                        DropdownMenu(expanded = showOverflowMenu, onDismissRequest = { showOverflowMenu = false }) {
                            if (canManageWorkflow) {
                                DropdownMenuItem(
                                    text = { Text("Workflow & SLA") },
                                    onClick = { showOverflowMenu = false; showWorkflowDialog = true },
                                )
                            }
                            DropdownMenuItem(
                                text = { Text(if (isArchived) strings.unarchive else strings.archive) },
                                leadingIcon = { Icon(Icons.Filled.Archive, contentDescription = null) },
                                onClick = { showOverflowMenu = false; viewModel.toggleArchiveConversation(conversation) },
                            )
                            DropdownMenuItem(
                                text = { Text(if (isMuted) strings.unmute else strings.mute) },
                                leadingIcon = { Icon(Icons.Filled.NotificationsOff, contentDescription = null) },
                                onClick = { showOverflowMenu = false; viewModel.toggleMuteConversation(conversation) },
                            )
                            DropdownMenuItem(
                                text = { Text("Disappearing (${conversation.disappearingHours}h)") },
                                leadingIcon = { Icon(Icons.Filled.Timer, contentDescription = null) },
                                onClick = { showOverflowMenu = false; showDisappearingDialog = true },
                            )
                        }
                    }
                },
            )
        },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (showSearchBar) {
                OutlinedTextField(
                    value = msgSearchQuery,
                    onValueChange = { msgSearchQuery = it },
                    placeholder = { Text(strings.searchMessages) },
                    singleLine = true,
                    trailingIcon = {
                        IconButton(onClick = { msgSearchQuery = ""; showSearchBar = false }) {
                            Icon(Icons.Filled.Close, contentDescription = strings.close)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }

            when (messagesState) {
                is UiState.Loading -> Box(Modifier.weight(1f).fillMaxWidth(), Alignment.Center) { CircularProgressIndicator() }
                is UiState.Error -> {
                    ConnectXErrorBanner(message = messagesState.message, modifier = Modifier.padding(16.dp))
                    Spacer(Modifier.weight(1f))
                }
                is UiState.Success -> {
                    val allMsgs = messagesState.data
                    val pinnedMsg = allMsgs.lastOrNull { it.pinned && !it.deleted }
                    val filteredMsgs = if (msgSearchQuery.isBlank()) allMsgs else {
                        val q = msgSearchQuery.trim().lowercase()
                        allMsgs.filter { it.body.lowercase().contains(q) || it.senderName.lowercase().contains(q) }
                    }

                    LaunchedEffect(allMsgs.size) {
                        if (allMsgs.isNotEmpty()) {
                            listState.animateScrollToItem(allMsgs.lastIndex)
                            viewModel.markMessagesRead(conversation.id, allMsgs)
                        }
                    }

                    if (pinnedMsg != null) {
                        Surface(
                            color = MaterialTheme.colorScheme.secondaryContainer,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                            shape = MaterialTheme.shapes.small,
                        ) {
                            Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.PushPin, contentDescription = "Pinned", modifier = Modifier.size(16.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("${pinnedMsg.senderName}: ${pinnedMsg.body}", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f))
                            }
                        }
                    }

                    LazyColumn(
                        state = listState,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(filteredMsgs, key = { it.id }) { msg ->
                            MessageBubble(
                                message = msg,
                                currentUserId = currentUserId,
                                onSelect = { selectedMessageForAction = msg },
                            )
                        }
                    }
                }
            }

            if (micNotice != null) {
                Text(micNotice!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 12.dp))
            }

            if (replyTarget != null) {
                Surface(color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f), modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), shape = MaterialTheme.shapes.small) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("Replying to ${replyTarget!!.senderName}: ${replyTarget!!.body}", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f))
                        IconButton(onClick = { replyTarget = null }) { Icon(Icons.Filled.Close, contentDescription = "Cancel reply") }
                    }
                }
            }

            if (attachedNote != null) {
                Surface(color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp), shape = MaterialTheme.shapes.small) {
                    Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(attachedNote!!, style = MaterialTheme.typography.labelMedium)
                        TextButton(onClick = { attachedNote = null; attachedFileMode = false }) { Text("Remove") }
                    }
                }
            }

            if (showEmojiBar && !isLocked) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    QUICK_EMOJIS.forEach { emoji ->
                        AssistChip(onClick = { draft += emoji }, label = { Text(emoji) })
                    }
                }
            }

            if (quickReplies.isNotEmpty() && !isLocked) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    quickReplies.forEach { qr ->
                        AssistChip(onClick = { draft = qr.shortcut }, label = { Text("${qr.shortcut} • ${qr.title}") })
                    }
                }
            }

            if (isLocked) {
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = "Resolved", modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("This thread is Resolved and locked.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            } else if (isRecordingVoice) {
                Surface(tonalElevation = 3.dp, color = MaterialTheme.colorScheme.errorContainer, modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Mic, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                            Spacer(Modifier.width(8.dp))
                            Text("Recording ${DeterministicRulesEngine.formatDuration(voiceSeconds)}", fontWeight = FontWeight.SemiBold)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { stopAndSendVoice(false) }) { Text(strings.cancel) }
                            Button(onClick = { stopAndSendVoice(true) }) {
                                Icon(Icons.Filled.Stop, contentDescription = "Send Voice Note")
                                Spacer(Modifier.width(4.dp))
                                Text("Send")
                            }
                        }
                    }
                }
            } else {
                Surface(tonalElevation = 2.dp, modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { showEmojiBar = !showEmojiBar }) {
                                Icon(Icons.Filled.InsertEmoticon, contentDescription = "Emoji picker")
                            }
                            IconButton(onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, modifier = Modifier.testTag("attach_photo_button")) {
                                Icon(Icons.Filled.PhotoLibrary, contentDescription = strings.attachPhoto)
                            }
                            IconButton(onClick = { filePicker.launch(arrayOf("*/*")) }, modifier = Modifier.testTag("attach_file_button")) {
                                Icon(Icons.Filled.AttachFile, contentDescription = strings.attachFile)
                            }
                            if (catalogItems.isNotEmpty()) {
                                IconButton(onClick = { showOrderCardPicker = true }, modifier = Modifier.testTag("share_catalog_item_button")) {
                                    Icon(Icons.Filled.ShoppingBag, contentDescription = "Share Catalog Item")
                                }
                            }
                            IconButton(
                                onClick = {
                                    val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                                    if (granted) startVoiceRecording() else micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                },
                                modifier = Modifier.testTag("record_voice_button"),
                            ) {
                                Icon(Icons.Filled.Mic, contentDescription = strings.voiceNote)
                            }
                        }
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = draft,
                                onValueChange = { draft = it },
                                placeholder = { Text("Type message or /shortcut") },
                                maxLines = 3,
                                modifier = Modifier.weight(1f).testTag("message_composer_input"),
                                shape = MaterialTheme.shapes.large,
                            )
                            Spacer(Modifier.width(6.dp))
                            IconButton(
                                onClick = {
                                    val msgText = draft.ifBlank { attachedNote ?: "" }
                                    if (msgText.isNotBlank()) {
                                        viewModel.sendMessage(
                                            conversation = conversation,
                                            body = msgText,
                                            messageType = if (attachedFileMode) MessageType.FILE else MessageType.TEXT,
                                            attachmentNote = attachedNote,
                                            replyPreview = replyTarget?.let { "${it.senderName}: ${it.body.take(80)}" },
                                        )
                                        draft = ""
                                        attachedNote = null
                                        attachedFileMode = false
                                        replyTarget = null
                                    }
                                },
                                enabled = draft.isNotBlank() || attachedNote != null,
                                modifier = Modifier.testTag("send_message_button"),
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Send,
                                    contentDescription = "Send Message",
                                    tint = if (draft.isNotBlank() || attachedNote != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    selectedMessageForAction?.let { msg ->
        AlertDialog(
            onDismissRequest = { selectedMessageForAction = null },
            title = { Text(msg.senderName) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        QUICK_EMOJIS.take(5).forEach { emoji ->
                            AssistChip(onClick = { viewModel.toggleMessageReaction(conversation.id, msg, emoji); selectedMessageForAction = null }, label = { Text(emoji) })
                        }
                    }
                    TextButton(onClick = { replyTarget = msg; selectedMessageForAction = null }) { Text(strings.reply) }
                    TextButton(onClick = { forwardTarget = msg; selectedMessageForAction = null }) { Text(strings.forward) }
                    TextButton(onClick = { viewModel.toggleMessagePin(conversation.id, msg); selectedMessageForAction = null }) {
                        Text(if (msg.pinned) "Unpin" else strings.pin)
                    }
                    TextButton(onClick = { viewModel.toggleMessageStar(conversation.id, msg); selectedMessageForAction = null }) {
                        Text(if (currentUserId in msg.starredByUids) "Unstar" else strings.star)
                    }
                    if (msg.senderId == currentUserId && !msg.deleted) {
                        TextButton(onClick = { editTarget = msg; selectedMessageForAction = null }) { Text(strings.edit) }
                        TextButton(onClick = { viewModel.softDeleteMessage(conversation.id, msg.id); selectedMessageForAction = null }) {
                            Text(strings.deleteLabel, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { selectedMessageForAction = null }) { Text(strings.close) } },
        )
    }

    editTarget?.let { msg ->
        var editedText by remember(msg.id) { mutableStateOf(msg.body) }
        AlertDialog(
            onDismissRequest = { editTarget = null },
            title = { Text(strings.edit) },
            text = { OutlinedTextField(value = editedText, onValueChange = { editedText = it }, modifier = Modifier.fillMaxWidth()) },
            confirmButton = {
                Button(onClick = { viewModel.editMessage(conversation.id, msg.id, editedText); editTarget = null }, enabled = editedText.isNotBlank()) {
                    Text(strings.save)
                }
            },
            dismissButton = { TextButton(onClick = { editTarget = null }) { Text(strings.cancel) } },
        )
    }

    forwardTarget?.let { msg ->
        AlertDialog(
            onDismissRequest = { forwardTarget = null },
            title = { Text(strings.forward) },
            text = {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(allConversations.filter { it.id != conversation.id }.take(10), key = { it.id }) { target ->
                        Card(modifier = Modifier.fillMaxWidth().clickable {
                            viewModel.sendMessage(target, "[Forwarded from ${msg.senderName}] ${msg.body}")
                            forwardTarget = null
                        }) {
                            Text(target.title, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.titleSmall)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { forwardTarget = null }) { Text(strings.close) } },
        )
    }

    if (showDisappearingDialog) {
        AlertDialog(
            onDismissRequest = { showDisappearingDialog = false },
            title = { Text("Disappearing Messages") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(0L to "Off", 24L to "24 Hours", 168L to "7 Days", 720L to "30 Days").forEach { (hrs, label) ->
                        FilterChip(
                            selected = conversation.disappearingHours == hrs,
                            onClick = { viewModel.setDisappearingHours(conversation.id, hrs); showDisappearingDialog = false },
                            label = { Text(label) },
                        )
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showDisappearingDialog = false }) { Text(strings.close) } },
        )
    }

    if (showWorkflowDialog) {
        WorkflowEditDialog(
            currentStatus = conversation.parsedStatus,
            currentPriority = conversation.parsedPriority,
            currentLabels = conversation.labels,
            onDismiss = { showWorkflowDialog = false },
            onSave = { s, p, l -> viewModel.updateConversationWorkflow(conversation.id, s, p, l); showWorkflowDialog = false },
        )
    }

    if (showOrderCardPicker) {
        AlertDialog(
            onDismissRequest = { showOrderCardPicker = false },
            title = { Text("Share Catalog Item") },
            text = {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(catalogItems.take(8), key = { it.id }) { item ->
                        Card(modifier = Modifier.fillMaxWidth().clickable {
                            val priceStr = DeterministicRulesEngine.formatMoney(item.priceCents, item.currency)
                            viewModel.sendMessage(conversation, "Product Quote: ${item.name} (${item.sku}) — $priceStr", MessageType.ORDER_CARD, item.priceCents, item.businessName)
                            showOrderCardPicker = false
                        }) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(item.name, style = MaterialTheme.typography.titleSmall)
                                Text("${item.sku} • ${DeterministicRulesEngine.formatMoney(item.priceCents, item.currency)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showOrderCardPicker = false }) { Text(strings.close) } },
        )
    }
}

@Composable
private fun MessageBubble(
    message: ChatMessage,
    currentUserId: String,
    onSelect: () -> Unit,
) {
    val isMine = message.senderId == currentUserId
    if (message.parsedType == MessageType.SYSTEM) {
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Surface(color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.65f), shape = MaterialTheme.shapes.small) {
                Text(message.body, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp))
            }
        }
        return
    }

    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = if (isMine) Alignment.End else Alignment.Start) {
        Surface(
            modifier = Modifier.widthIn(max = 320.dp).clickable(onClick = onSelect),
            shape = MaterialTheme.shapes.medium,
            color = when {
                message.parsedType == MessageType.ORDER_CARD -> MaterialTheme.colorScheme.tertiaryContainer
                isMine -> MaterialTheme.colorScheme.primary
                else -> MaterialTheme.colorScheme.surfaceContainerHigh
            },
            contentColor = when {
                message.parsedType == MessageType.ORDER_CARD -> MaterialTheme.colorScheme.onTertiaryContainer
                isMine -> MaterialTheme.colorScheme.onPrimary
                else -> MaterialTheme.colorScheme.onSurface
            },
        ) {
            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                if (!isMine || message.parsedType == MessageType.ORDER_CARD) {
                    Text(message.senderName, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(2.dp))
                }
                if (message.replyPreview != null) {
                    Surface(color = MaterialTheme.colorScheme.surface.copy(alpha = 0.25f), shape = MaterialTheme.shapes.extraSmall) {
                        Text(message.replyPreview, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(6.dp))
                    }
                    Spacer(Modifier.height(4.dp))
                }
                if (message.parsedType == MessageType.VOICE) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Mic, contentDescription = "Voice Note", modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(message.body, style = MaterialTheme.typography.bodyMedium)
                    }
                } else if (message.parsedType == MessageType.FILE) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Description, contentDescription = "File", modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(message.body, style = MaterialTheme.typography.bodyMedium)
                    }
                } else {
                    Text(
                        text = message.body,
                        style = MaterialTheme.typography.bodyLarge,
                        fontStyle = if (message.deleted) FontStyle.Italic else FontStyle.Normal,
                    )
                }
                if (message.attachmentNote != null && message.parsedType != MessageType.FILE) {
                    Spacer(Modifier.height(4.dp))
                    Text("[${message.attachmentNote}]", style = MaterialTheme.typography.labelSmall)
                }
                if (message.reactions.isNotEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    Text(message.reactions.joinToString(" ") { it.substringBefore(":") }, style = MaterialTheme.typography.labelMedium)
                }
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (message.pinned) Icon(Icons.Filled.PushPin, contentDescription = "Pinned", modifier = Modifier.size(12.dp))
                    if (currentUserId in message.starredByUids) Icon(Icons.Filled.Star, contentDescription = "Starred", modifier = Modifier.size(12.dp))
                    Text(
                        text = buildString {
                            append(formatTimestamp(message.createdAt))
                            if (message.edited && !message.deleted) append(" • edited")
                        },
                        style = MaterialTheme.typography.labelSmall,
                    )
                    if (isMine && message.readByUids.size > 1) {
                        Icon(Icons.Filled.DoneAll, contentDescription = "Read", modifier = Modifier.size(14.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun WorkflowEditDialog(
    currentStatus: ConversationStatus,
    currentPriority: PriorityLevel,
    currentLabels: List<String>,
    onDismiss: () -> Unit,
    onSave: (ConversationStatus, PriorityLevel, List<String>) -> Unit,
) {
    var status by remember { mutableStateOf(currentStatus) }
    var priority by remember { mutableStateOf(currentPriority) }
    var labelsText by remember { mutableStateOf(currentLabels.joinToString(", ")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Thread Status & SLA Priority") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Status", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ConversationStatus.entries.forEach { s -> FilterChip(selected = status == s, onClick = { status = s }, label = { Text(s.label) }) }
                }
                Text("Priority", style = MaterialTheme.typography.labelMedium)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PriorityLevel.entries.forEach { p -> FilterChip(selected = priority == p, onClick = { priority = p }, label = { Text(p.label) }) }
                }
                OutlinedTextField(value = labelsText, onValueChange = { labelsText = it }, label = { Text("Labels") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = { OutlinedButton(onClick = { onSave(status, priority, labelsText.split(",").map { it.trim() }.filter { it.isNotEmpty() }) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
