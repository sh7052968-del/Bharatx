package com.example.ui.screens

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.UiState
import com.example.model.ConversationType
import com.example.model.DeterministicRulesEngine
import com.example.model.TicketStatus
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.PriorityBadge
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.ui.i18n.LocalConnectXStrings
import com.example.viewmodel.ConnectXViewModel

private val HELP_CENTER_TOPICS = listOf(
    "Zero-Trust Workspace Auth" to "ConnectX uses Google Sign-In via Jetpack Credential Manager with per-user Firestore rules.",
    "Deterministic SLA Priority" to "Keywords like outage/urgent/payment automatically prioritize support threads without AI.",
    "Disappearing & Archived Chats" to "Use Thread Options inside any conversation to archive, mute, or set disappearing intervals.",
    "Billing & Subscriptions" to "Switch between Starter, Growth Pro, and Enterprise Desk under Business -> Billing.",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportScreen(
    viewModel: ConnectXViewModel,
    onOpenSupportChat: () -> Unit,
    modifier: Modifier = Modifier,
    showTopBar: Boolean = true,
) {
    val strings = LocalConnectXStrings.current
    val ticketsState by viewModel.supportTickets.collectAsStateWithLifecycle()
    var showCreateTicket by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = if (showTopBar) androidx.compose.material3.ScaffoldDefaults.contentWindowInsets else androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
        topBar = {
            if (showTopBar) {
                TopAppBar(
                    title = {
                        Column {
                            Text(strings.supportTab, style = MaterialTheme.typography.titleLarge)
                            Text("${strings.helpCenterTitle} & ${strings.supportTicketsTitle}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    },
                    actions = {
                        TextButton(onClick = {
                            viewModel.createConversation(
                                title = "ConnectX Support Desk",
                                type = ConversationType.SUPPORT,
                                participantUids = emptyList(),
                                initialMessage = "Hello Support Team, I need assistance with my workspace.",
                                labels = listOf("support"),
                            ) { onOpenSupportChat() }
                        }) { Text("Live Desk") }
                    },
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { showCreateTicket = true }, modifier = Modifier.testTag("create_ticket_fab")) {
                Icon(Icons.Filled.Add, contentDescription = "Create Support Ticket")
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            contentPadding = PaddingValues(bottom = 88.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item { Text(strings.helpCenterTitle, style = MaterialTheme.typography.titleMedium) }
            items(HELP_CENTER_TOPICS) { (title, body) ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                    Column(modifier = Modifier.fillMaxWidth().padding(14.dp)) {
                        Text(title, style = MaterialTheme.typography.titleSmall)
                        Spacer(Modifier.height(4.dp))
                        Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            item {
                Spacer(Modifier.height(4.dp))
                Text(strings.supportTicketsTitle, style = MaterialTheme.typography.titleMedium)
            }

            when (val state = ticketsState) {
                is UiState.Loading -> item { Box(Modifier.fillMaxWidth(), Alignment.Center) { CircularProgressIndicator() } }
                is UiState.Error -> item { ConnectXErrorBanner(state.message) }
                is UiState.Success -> {
                    if (state.data.isEmpty()) {
                        item {
                            ConnectXEmptyState(
                                icon = Icons.Filled.SupportAgent,
                                title = "No support tickets filed",
                                subtitle = "Create a support ticket with automatic deterministic SLA priority routing.",
                                actionLabel = "New Ticket",
                                onAction = { showCreateTicket = true },
                            )
                        }
                    } else {
                        items(state.data, key = { it.id }) { ticket ->
                            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text(ticket.subject, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                                        PriorityBadge(ticket.parsedPriority)
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    Text("${ticket.category} • ${formatTimestamp(ticket.createdAt)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Spacer(Modifier.height(6.dp))
                                    Text(ticket.description, style = MaterialTheme.typography.bodyMedium)
                                    Spacer(Modifier.height(8.dp))
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        StatusPill(
                                            text = ticket.parsedStatus.label.uppercase(),
                                            containerColor = if (ticket.parsedStatus == TicketStatus.RESOLVED) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.secondaryContainer,
                                            contentColor = if (ticket.parsedStatus == TicketStatus.RESOLVED) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSecondaryContainer,
                                        )
                                        if (ticket.parsedStatus != TicketStatus.RESOLVED) {
                                            OutlinedButton(onClick = { viewModel.updateSupportTicketStatus(ticket, TicketStatus.RESOLVED) }) {
                                                Text("Mark Resolved")
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

    if (showCreateTicket) {
        var subject by remember { mutableStateOf("") }
        var category by remember { mutableStateOf("Technical") }
        var description by remember { mutableStateOf("") }
        val predicted = remember(subject, description) { DeterministicRulesEngine.classifySupportPriority(subject, description) }

        AlertDialog(
            onDismissRequest = { showCreateTicket = false },
            title = { Text("Create Support Ticket") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = subject, onValueChange = { subject = it }, label = { Text("Subject") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("Technical", "Billing", "Security", "Account").forEach { cat ->
                            FilterChip(selected = category == cat, onClick = { category = cat }, label = { Text(cat) })
                        }
                    }
                    OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Describe the issue") }, minLines = 3, modifier = Modifier.fillMaxWidth())
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("SLA Priority: ", style = MaterialTheme.typography.labelMedium)
                        PriorityBadge(predicted)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.createSupportTicket(subject, category, description)
                        showCreateTicket = false
                    },
                    enabled = subject.trim().length >= 2 && description.trim().length >= 2,
                ) { Text("Submit") }
            },
            dismissButton = { TextButton(onClick = { showCreateTicket = false }) { Text(strings.cancel) } },
        )
    }
}
