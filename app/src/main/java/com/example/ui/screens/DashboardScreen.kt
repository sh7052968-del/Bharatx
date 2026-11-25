package com.example.ui.screens

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
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.SupportAgent
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.UiState
import com.example.model.CallStatus
import com.example.model.ConversationType
import com.example.model.OrderStatus
import com.example.model.PresenceStatus
import com.example.model.TicketStatus
import com.example.ui.components.AvatarCircle
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.ui.i18n.LocalConnectXStrings
import com.example.viewmodel.ConnectXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: ConnectXViewModel,
    onNavigateToChats: () -> Unit,
    onNavigateToHub: () -> Unit,
    onNavigateToBusiness: () -> Unit,
    onNavigateToMore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()
    val conversationsState by viewModel.conversations.collectAsStateWithLifecycle()
    val membersState by viewModel.directoryMembers.collectAsStateWithLifecycle()
    val catalogState by viewModel.publicCatalog.collectAsStateWithLifecycle()
    val ordersState by viewModel.orders.collectAsStateWithLifecycle()
    val callsState by viewModel.calls.collectAsStateWithLifecycle()
    val ticketsState by viewModel.supportTickets.collectAsStateWithLifecycle()
    val auditState by viewModel.auditLogs.collectAsStateWithLifecycle()

    var globalQuery by remember { mutableStateOf("") }
    var showNotifications by remember { mutableStateOf(false) }

    val profile = (profileState as? UiState.Success)?.data
    val conversations = (conversationsState as? UiState.Success)?.data ?: emptyList()
    val members = (membersState as? UiState.Success)?.data ?: emptyList()
    val catalog = (catalogState as? UiState.Success)?.data ?: emptyList()
    val orders = (ordersState as? UiState.Success)?.data ?: emptyList()
    val calls = (callsState as? UiState.Success)?.data ?: emptyList()
    val tickets = (ticketsState as? UiState.Success)?.data ?: emptyList()
    val audits = (auditState as? UiState.Success)?.data ?: emptyList()

    val onlineMembers = members.filter { it.parsedPresence == PresenceStatus.ONLINE }
    val activeConversations = conversations.filter { viewModel.currentUserId !in it.archivedByUids }
    val pendingOrders = orders.count { it.parsedStatus == OrderStatus.PENDING }
    val missedCalls = calls.count { it.parsedStatus == CallStatus.MISSED || it.parsedStatus == CallStatus.RINGING }
    val openTickets = tickets.count { it.parsedStatus != TicketStatus.RESOLVED }
    val notificationCount = pendingOrders + missedCalls + openTickets

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(strings.dashboardTitle, style = MaterialTheme.typography.titleLarge)
                        Text(
                            strings.dashboardSubtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = { showNotifications = true },
                        modifier = Modifier.testTag("notifications_button"),
                    ) {
                        BadgedBox(
                            badge = {
                                if (notificationCount > 0) {
                                    Badge { Text("$notificationCount") }
                                }
                            },
                        ) {
                            Icon(Icons.Filled.Notifications, contentDescription = strings.notificationsTitle)
                        }
                    }
                    IconButton(
                        onClick = onNavigateToMore,
                        modifier = Modifier.testTag("profile_menu_button"),
                    ) {
                        AvatarCircle(
                            name = profile?.displayName ?: "CX",
                            size = 34.dp,
                            presence = profile?.parsedPresence,
                        )
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                OutlinedTextField(
                    value = globalQuery,
                    onValueChange = { globalQuery = it },
                    placeholder = { Text(strings.globalSearchPlaceholder) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = "Global Search") },
                    singleLine = true,
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.fillMaxWidth().testTag("global_search_input"),
                )
            }

            if (globalQuery.isNotBlank()) {
                val q = globalQuery.trim().lowercase()
                val matchedChats = conversations.filter { it.title.lowercase().contains(q) || it.lastMessageText.lowercase().contains(q) }
                val matchedMembers = members.filter { it.displayName.lowercase().contains(q) || it.handle.lowercase().contains(q) }
                val matchedCatalog = catalog.filter { it.name.lowercase().contains(q) || it.sku.lowercase().contains(q) }
                val matchedTickets = tickets.filter { it.subject.lowercase().contains(q) }

                item {
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Search Results", style = MaterialTheme.typography.titleSmall)
                            if (matchedChats.isEmpty() && matchedMembers.isEmpty() && matchedCatalog.isEmpty() && matchedTickets.isEmpty()) {
                                Text("No matching threads, people, catalog items, or tickets.", style = MaterialTheme.typography.bodySmall)
                            } else {
                                matchedChats.take(4).forEach { conv ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clickable {
                                            viewModel.selectConversation(conv.id)
                                            onNavigateToChats()
                                        }.padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(conv.title, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                                        StatusPill(conv.parsedType.label, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                    }
                                }
                                matchedMembers.take(4).forEach { member ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clickable { onNavigateToHub() }.padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        AvatarCircle(name = member.displayName, size = 24.dp, presence = member.parsedPresence)
                                        Spacer(Modifier.width(8.dp))
                                        Text("${member.displayName} (@${member.handle})", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                                matchedCatalog.take(3).forEach { item ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clickable { onNavigateToBusiness() }.padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(Icons.Filled.Storefront, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text("${item.name} (${item.sku})", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                                matchedTickets.take(3).forEach { tk ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clickable { onNavigateToMore() }.padding(vertical = 4.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(Icons.Filled.SupportAgent, contentDescription = null, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(8.dp))
                                        Text(tk.subject, style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    DashboardMetricCard(
                        title = strings.navChats,
                        value = "${activeConversations.size}",
                        subtitle = "${activeConversations.count { it.parsedType == ConversationType.SUPPORT }} Support",
                        modifier = Modifier.weight(1f).clickable { onNavigateToChats() },
                    )
                    DashboardMetricCard(
                        title = strings.contactsTab,
                        value = "${onlineMembers.size}",
                        subtitle = "Online now",
                        modifier = Modifier.weight(1f).clickable { onNavigateToHub() },
                    )
                    DashboardMetricCard(
                        title = strings.ordersTab,
                        value = "${orders.size}",
                        subtitle = "$pendingOrders pending",
                        modifier = Modifier.weight(1f).clickable { onNavigateToBusiness() },
                    )
                }
            }

            item {
                Text(strings.onlineContactsTitle, style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.height(6.dp))
                if (onlineMembers.isEmpty()) {
                    Text(
                        "Workspace members online status appears here as colleagues sign in.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        onlineMembers.forEach { member ->
                            Card(
                                modifier = Modifier.clickable { onNavigateToHub() },
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                            ) {
                                Column(
                                    modifier = Modifier.padding(12.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                ) {
                                    AvatarCircle(name = member.displayName, size = 44.dp, presence = member.parsedPresence)
                                    Spacer(Modifier.height(6.dp))
                                    Text(member.displayName, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text("@${member.handle}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Recent Conversations", style = MaterialTheme.typography.titleMedium)
                    TextButton(onClick = onNavigateToChats) { Text("View all") }
                }
            }

            if (activeConversations.isEmpty()) {
                item {
                    ConnectXEmptyState(
                        icon = Icons.AutoMirrored.Filled.Chat,
                        title = "No active chats yet",
                        subtitle = "Open Chats to start a direct message, group, or SLA support thread.",
                        actionLabel = strings.newConversation,
                        onAction = onNavigateToChats,
                    )
                }
            } else {
                items(activeConversations.take(4), key = { it.id }) { conv ->
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable {
                            viewModel.selectConversation(conv.id)
                            onNavigateToChats()
                        },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                    ) {
                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            AvatarCircle(name = conv.title, size = 40.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(conv.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(conv.lastMessageText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Text(formatTimestamp(conv.lastMessageAt ?: conv.createdAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }

            item {
                Text(strings.recentActivityTitle, style = MaterialTheme.typography.titleMedium)
            }

            if (audits.isEmpty()) {
                item {
                    Surface(
                        color = MaterialTheme.colorScheme.surfaceContainerLow,
                        shape = MaterialTheme.shapes.medium,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.History, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(10.dp))
                            Text("Actions across messaging, orders, billing, and tickets appear in your audit feed.", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            } else {
                items(audits.take(5), key = { it.id }) { log ->
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                        Row(modifier = Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(log.summary, style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                Text("${log.action} • ${formatTimestamp(log.createdAt)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }

    if (showNotifications) {
        AlertDialog(
            onDismissRequest = { showNotifications = false },
            title = { Text(strings.notificationsTitle) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (notificationCount == 0) {
                        Text("You are caught up. No pending orders, missed calls, or open support tickets.", style = MaterialTheme.typography.bodySmall)
                    } else {
                        if (missedCalls > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Call, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
                                Spacer(Modifier.width(8.dp))
                                Text("$missedCalls active or missed call events", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        if (pendingOrders > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.Storefront, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(8.dp))
                                Text("$pendingOrders pending business orders", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        if (openTickets > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.SupportAgent, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.secondary)
                                Spacer(Modifier.width(8.dp))
                                Text("$openTickets open support tickets", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showNotifications = false }) { Text(strings.close) }
            },
        )
    }
}

@Composable
private fun DashboardMetricCard(
    title: String,
    value: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, style = MaterialTheme.typography.labelMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(subtitle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
