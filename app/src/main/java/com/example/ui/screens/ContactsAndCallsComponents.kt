package com.example.ui.screens

import android.content.Intent
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.CallMissed
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.UiState
import com.example.model.CallSession
import com.example.model.CallStatus
import com.example.model.CallType
import com.example.model.ContactEntry
import com.example.model.ConversationType
import com.example.model.DeterministicRulesEngine
import com.example.model.DirectoryMember
import com.example.ui.components.AvatarCircle
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.viewmodel.ConnectXViewModel
import kotlinx.coroutines.delay

@Composable
fun ContactsTabContent(
    viewModel: ConnectXViewModel,
    contactsState: UiState<List<ContactEntry>>,
    directoryState: UiState<List<DirectoryMember>>,
    onOpenChat: () -> Unit,
    showAddDialog: Boolean,
    onDismissAddDialog: () -> Unit,
    onOpenAddDialog: () -> Unit,
) {
    val context = LocalContext.current
    var search by remember { mutableStateOf("") }
    var showBlockedOnly by remember { mutableStateOf(false) }
    var inspectedContact by remember { mutableStateOf<ContactEntry?>(null) }

    val members = (directoryState as? UiState.Success)?.data ?: emptyList()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search contacts") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier.weight(1f).testTag("contacts_search_input"),
                shape = MaterialTheme.shapes.medium,
            )
            OutlinedButton(
                onClick = {
                    val shareIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Join my ConnectX enterprise workspace to message and collaborate securely.")
                    }
                    context.startActivity(Intent.createChooser(shareIntent, "Invite to ConnectX"))
                },
                modifier = Modifier.testTag("invite_contact_button"),
            ) {
                Icon(Icons.Filled.Share, contentDescription = "Invite", modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text("Invite")
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !showBlockedOnly, onClick = { showBlockedOnly = false }, label = { Text("Contacts") })
            FilterChip(selected = showBlockedOnly, onClick = { showBlockedOnly = true }, label = { Text("Blocked") })
        }
        Spacer(Modifier.height(8.dp))

        when (contactsState) {
            is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            is UiState.Error -> ConnectXErrorBanner(contactsState.message)
            is UiState.Success -> {
                val filtered = contactsState.data.filter { c ->
                    val matchBlock = if (showBlockedOnly) c.blocked else !c.blocked
                    val q = search.trim().lowercase()
                    val matchSearch = q.isEmpty() || c.displayName.lowercase().contains(q) || c.handle.lowercase().contains(q)
                    matchBlock && matchSearch
                }
                if (filtered.isEmpty()) {
                    ConnectXEmptyState(
                        icon = Icons.Filled.Contacts,
                        title = if (showBlockedOnly) "No blocked contacts" else "No saved contacts yet",
                        subtitle = "Add workspace colleagues or external business contacts to message and call quickly.",
                        actionLabel = if (showBlockedOnly) null else "Add Contact",
                        onAction = if (showBlockedOnly) null else onOpenAddDialog,
                    )
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(filtered, key = { it.id }) { contact ->
                            Card(
                                modifier = Modifier.fillMaxWidth().clickable { inspectedContact = contact },
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                            ) {
                                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    AvatarCircle(name = contact.displayName, size = 44.dp)
                                    Spacer(Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(contact.displayName, style = MaterialTheme.typography.titleMedium)
                                        Text(
                                            "@${contact.handle}" + (contact.department?.let { " • $it" } ?: ""),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                        if (contact.blocked) {
                                            Spacer(Modifier.height(4.dp))
                                            StatusPill("BLOCKED", MaterialTheme.colorScheme.errorContainer, MaterialTheme.colorScheme.onErrorContainer)
                                        }
                                    }
                                    IconButton(onClick = {
                                        viewModel.startCall(contact.contactUid ?: contact.id, contact.displayName, CallType.VOICE)
                                    }) {
                                        Icon(Icons.Filled.Call, contentDescription = "Voice Call")
                                    }
                                    IconButton(onClick = { viewModel.toggleBlockContact(contact) }) {
                                        Icon(Icons.Filled.Block, contentDescription = if (contact.blocked) "Unblock" else "Block")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        var name by remember { mutableStateOf("") }
        var handle by remember { mutableStateOf("") }
        var dept by remember { mutableStateOf("") }
        var note by remember { mutableStateOf("") }
        var linkedUid by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = onDismissAddDialog,
            title = { Text("Add Contact") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    val others = members.filter { it.userId != viewModel.currentUserId }
                    if (others.isNotEmpty()) {
                        Text("Quick pick workspace member:", style = MaterialTheme.typography.labelSmall)
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            others.take(6).forEach { m ->
                                FilterChip(
                                    selected = linkedUid == m.userId,
                                    onClick = {
                                        linkedUid = m.userId
                                        name = m.displayName
                                        handle = m.handle
                                        dept = m.department
                                    },
                                    label = { Text(m.displayName) },
                                )
                            }
                        }
                    }
                    OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Full Name") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("add_contact_name"))
                    OutlinedTextField(value = handle, onValueChange = { handle = it }, label = { Text("Handle") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("add_contact_handle"))
                    OutlinedTextField(value = dept, onValueChange = { dept = it }, label = { Text("Department (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Note (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.addContact(name, handle, linkedUid, dept, note)
                        onDismissAddDialog()
                    },
                    enabled = name.isNotBlank() && handle.isNotBlank(),
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = onDismissAddDialog) { Text("Cancel") } },
        )
    }

    inspectedContact?.let { contact ->
        AlertDialog(
            onDismissRequest = { inspectedContact = null },
            title = { Text(contact.displayName) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("@${contact.handle}", style = MaterialTheme.typography.bodyMedium)
                    contact.department?.let { Text("Department: $it", style = MaterialTheme.typography.bodySmall) }
                    contact.note?.let { Text("Note: $it", style = MaterialTheme.typography.bodySmall) }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            viewModel.createConversation(
                                title = contact.displayName,
                                type = ConversationType.DIRECT,
                                participantUids = listOfNotNull(contact.contactUid),
                                initialMessage = "Hi ${contact.displayName}",
                                labels = emptyList(),
                            ) {
                                inspectedContact = null
                                onOpenChat()
                            }
                        }) { Text("Message") }
                        OutlinedButton(onClick = {
                            viewModel.startCall(contact.contactUid ?: contact.id, contact.displayName, CallType.VIDEO)
                            inspectedContact = null
                        }) { Text("Video Call") }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteContact(contact.id); inspectedContact = null }) {
                    Icon(Icons.Filled.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Remove", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { inspectedContact = null }) { Text("Close") } },
        )
    }
}

@Composable
fun CallsTabContent(
    viewModel: ConnectXViewModel,
    callsState: UiState<List<CallSession>>,
    contactsState: UiState<List<ContactEntry>>,
    directoryState: UiState<List<DirectoryMember>>,
    showStartCallDialog: Boolean,
    onDismissStartCall: () -> Unit,
    onOpenStartCall: () -> Unit,
) {
    var missedOnly by remember { mutableStateOf(false) }
    val contacts = (contactsState as? UiState.Success)?.data ?: emptyList()
    val members = (directoryState as? UiState.Success)?.data ?: emptyList()

    Column(modifier = Modifier.fillMaxSize()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !missedOnly, onClick = { missedOnly = false }, label = { Text("All Calls") })
            FilterChip(selected = missedOnly, onClick = { missedOnly = true }, label = { Text("Missed") })
        }
        Spacer(Modifier.height(8.dp))

        when (callsState) {
            is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            is UiState.Error -> ConnectXErrorBanner(callsState.message)
            is UiState.Success -> {
                val filtered = callsState.data.filter { !missedOnly || it.parsedStatus == CallStatus.MISSED || it.parsedStatus == CallStatus.DECLINED }
                if (filtered.isEmpty()) {
                    ConnectXEmptyState(
                        icon = Icons.Filled.Call,
                        title = if (missedOnly) "No missed calls" else "No call history yet",
                        subtitle = "Start a voice, video, or group call session with a workspace member or saved contact.",
                        actionLabel = if (missedOnly) null else "Start Call",
                        onAction = if (missedOnly) null else onOpenStartCall,
                    )
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 88.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(filtered, key = { it.id }) { call ->
                            val isOutgoing = call.callerId == viewModel.currentUserId
                            val peerName = if (isOutgoing) call.calleeName else call.callerName
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                    AvatarCircle(name = peerName, size = 42.dp)
                                    Spacer(Modifier.width(12.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(peerName, style = MaterialTheme.typography.titleMedium)
                                        Text(
                                            "${call.parsedType.label} • ${call.parsedStatus.label} • ${DeterministicRulesEngine.formatDuration(call.durationSeconds)}",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = if (call.parsedStatus == CallStatus.MISSED) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                        Text(formatTimestamp(call.createdAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    IconButton(onClick = {
                                        val peerId = if (isOutgoing) call.calleeId else call.callerId
                                        viewModel.startCall(peerId, peerName, call.parsedType)
                                    }) {
                                        Icon(
                                            imageVector = if (call.parsedType == CallType.VIDEO) Icons.Filled.Videocam else Icons.Filled.Call,
                                            contentDescription = "Call back",
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showStartCallDialog) {
        var callType by remember { mutableStateOf(CallType.VOICE) }
        var customName by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = onDismissStartCall,
            title = { Text("Start Call") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CallType.entries.forEach { t -> FilterChip(selected = callType == t, onClick = { callType = t }, label = { Text(t.label) }) }
                    }
                    OutlinedTextField(value = customName, onValueChange = { customName = it }, label = { Text("Callee / Group Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    val peers = (contacts.map { (it.contactUid ?: it.id) to it.displayName } +
                        members.filter { it.userId != viewModel.currentUserId }.map { it.userId to it.displayName }).distinctBy { it.second }
                    peers.take(5).forEach { (peerId, peerName) ->
                        OutlinedButton(
                            onClick = { viewModel.startCall(peerId, peerName, callType); onDismissStartCall() },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("${callType.label} • $peerName") }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { viewModel.startCall("group_bridge_${System.currentTimeMillis()}", customName, callType); onDismissStartCall() },
                    enabled = customName.isNotBlank(),
                ) { Text("Dial") }
            },
            dismissButton = { TextButton(onClick = onDismissStartCall) { Text("Cancel") } },
        )
    }
}

@Composable
fun ActiveCallOverlayDialog(
    call: CallSession,
    currentUserId: String,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onEnd: (Long) -> Unit,
) {
    val isOutgoing = call.callerId == currentUserId
    val peerName = if (isOutgoing) call.calleeName else call.callerName
    var micMuted by remember(call.id) { mutableStateOf(false) }
    var cameraOff by remember(call.id) { mutableStateOf(call.parsedType == CallType.VOICE) }
    var speakerOn by remember(call.id) { mutableStateOf(false) }
    var elapsedSec by remember(call.id) { mutableLongStateOf(0L) }

    LaunchedEffect(call.id, call.status) {
        if (call.parsedStatus == CallStatus.ACTIVE) {
            while (true) {
                delay(1000L)
                elapsedSec += 1L
            }
        }
    }

    AlertDialog(
        onDismissRequest = {},
        title = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                AvatarCircle(name = peerName, size = 64.dp)
                Spacer(Modifier.height(10.dp))
                Text(peerName, style = MaterialTheme.typography.titleLarge)
                Text(
                    when (call.parsedStatus) {
                        CallStatus.RINGING -> if (isOutgoing) "Calling (${call.parsedType.label})..." else "Incoming ${call.parsedType.label} Call"
                        CallStatus.ACTIVE -> "${call.parsedType.label} • ${DeterministicRulesEngine.formatDuration(elapsedSec)}"
                        else -> call.parsedStatus.label
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        },
        text = {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                IconButton(onClick = { micMuted = !micMuted }) {
                    Icon(if (micMuted) Icons.Filled.MicOff else Icons.Filled.Mic, contentDescription = "Toggle Mic")
                }
                IconButton(onClick = { cameraOff = !cameraOff }) {
                    Icon(if (cameraOff) Icons.Filled.VideocamOff else Icons.Filled.Videocam, contentDescription = "Toggle Camera")
                }
                IconButton(onClick = { speakerOn = !speakerOn }) {
                    Icon(Icons.Filled.VolumeUp, contentDescription = "Speaker", tint = if (speakerOn) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        confirmButton = {
            if (!isOutgoing && call.parsedStatus == CallStatus.RINGING) {
                Button(onClick = onAccept) { Text("Accept") }
            } else {
                Button(
                    onClick = { onEnd(elapsedSec) },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError),
                ) {
                    Icon(Icons.Filled.CallEnd, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("End")
                }
            }
        },
        dismissButton = {
            if (!isOutgoing && call.parsedStatus == CallStatus.RINGING) {
                TextButton(onClick = onDecline) { Text("Decline", color = MaterialTheme.colorScheme.error) }
            }
        },
    )
}
