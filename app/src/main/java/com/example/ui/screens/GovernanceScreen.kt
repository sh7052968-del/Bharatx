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
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.UiState
import com.example.model.AuditLog
import com.example.model.DeterministicRulesEngine
import com.example.model.DirectoryMember
import com.example.model.UserRole
import com.example.ui.components.AvatarCircle
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.RoleBadge
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.viewmodel.ConnectXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GovernanceScreen(
    viewModel: ConnectXViewModel,
    modifier: Modifier = Modifier,
    showTopBar: Boolean = true,
) {
    val directoryState by viewModel.directoryMembers.collectAsStateWithLifecycle()
    val auditLogsState by viewModel.auditLogs.collectAsStateWithLifecycle()
    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()

    val currentRole = (profileState as? UiState.Success)?.data?.parsedRole ?: UserRole.MEMBER
    val isAdmin = DeterministicRulesEngine.canManageRoles(currentRole)

    var selectedTab by remember { mutableIntStateOf(0) }
    var roleEditMember by remember { mutableStateOf<DirectoryMember?>(null) }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = if (showTopBar) androidx.compose.material3.ScaffoldDefaults.contentWindowInsets else androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
        topBar = {
            if (showTopBar) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Directory & RBAC", style = MaterialTheme.typography.titleLarge)
                            Text(
                                "Role-Based Permissions & Audit Trail",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                )
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
        ) {
            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                listOf("Directory", "RBAC Matrix", "Audit Log").forEachIndexed { index, label ->
                    SegmentedButton(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        shape = SegmentedButtonDefaults.itemShape(index = index, count = 3),
                        modifier = Modifier.testTag("governance_tab_$index"),
                    ) {
                        Text(label)
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            when (selectedTab) {
                0 -> DirectoryTab(
                    state = directoryState,
                    isAdmin = isAdmin,
                    currentUserId = viewModel.currentUserId,
                    onEditRole = { roleEditMember = it },
                )
                1 -> RbacMatrixTab(currentRole = currentRole)
                2 -> AuditLogTab(state = auditLogsState)
            }
        }
    }

    roleEditMember?.let { member ->
        EditMemberRoleDialog(
            member = member,
            onDismiss = { roleEditMember = null },
            onSave = { newRole, dept ->
                viewModel.updateMemberRoleByAdmin(member.userId, newRole, dept)
                roleEditMember = null
            },
        )
    }
}

@Composable
private fun DirectoryTab(
    state: UiState<List<DirectoryMember>>,
    isAdmin: Boolean,
    currentUserId: String,
    onEditRole: (DirectoryMember) -> Unit,
) {
    when (state) {
        is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        is UiState.Error -> ConnectXErrorBanner(state.message)
        is UiState.Success -> {
            if (state.data.isEmpty()) {
                ConnectXEmptyState(
                    icon = Icons.Filled.Group,
                    title = "No workspace members indexed",
                    subtitle = "Signed-in members appear in this PII-free workspace directory.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(state.data, key = { it.id }) { member ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                AvatarCircle(
                                    name = member.displayName,
                                    presence = member.parsedPresence,
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = if (member.userId == currentUserId) "${member.displayName} (You)" else member.displayName,
                                        style = MaterialTheme.typography.titleMedium,
                                    )
                                    Text(
                                        text = "@${member.handle} • ${member.department}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    RoleBadge(member.parsedRole)
                                }
                                if (isAdmin) {
                                    OutlinedButton(onClick = { onEditRole(member) }) {
                                        Text("Role")
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

@Composable
private fun RbacMatrixTab(currentRole: UserRole) {
    LazyColumn(
        contentPadding = PaddingValues(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.AdminPanelSettings, contentDescription = "Your Role", tint = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Your Active Role: ${currentRole.label}", style = MaterialTheme.typography.titleSmall)
                        Text(currentRole.description, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        items(UserRole.entries) { role ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    RoleBadge(role)
                    Text(role.description, style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (DeterministicRulesEngine.canManageRoles(role)) {
                            StatusPill("ROLE ADMIN", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
                        }
                        if (DeterministicRulesEngine.canManageTickets(role)) {
                            StatusPill("SLA TRIAGE", MaterialTheme.colorScheme.tertiaryContainer, MaterialTheme.colorScheme.onTertiaryContainer)
                        }
                        StatusPill("MESSAGING", MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

@Composable
private fun AuditLogTab(state: UiState<List<AuditLog>>) {
    var filterTarget by remember { mutableStateOf<String?>(null) }
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(selected = filterTarget == null, onClick = { filterTarget = null }, label = { Text("All") })
            listOf("CONVERSATION", "CHANNEL", "CATALOG_ITEM", "ORDER", "USER").forEach { target ->
                FilterChip(
                    selected = filterTarget == target,
                    onClick = { filterTarget = if (filterTarget == target) null else target },
                    label = { Text(target) },
                )
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        when (state) {
            is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            is UiState.Error -> ConnectXErrorBanner(state.message)
            is UiState.Success -> {
                val filtered = state.data.filter { filterTarget == null || it.targetType == filterTarget }
                if (filtered.isEmpty()) {
                    ConnectXEmptyState(
                        icon = Icons.Filled.History,
                        title = "No audit entries",
                        subtitle = "All workspace mutations write an immutable audit event automatically.",
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(filtered, key = { it.id }) { log ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                    ) {
                                        StatusPill(
                                            text = log.action,
                                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                        )
                                        Text(
                                            text = formatTimestamp(log.createdAt),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(log.summary, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        "Actor: ${log.actorName} • Target: ${log.targetType}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
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

@Composable
private fun EditMemberRoleDialog(
    member: DirectoryMember,
    onDismiss: () -> Unit,
    onSave: (UserRole, String) -> Unit,
) {
    var selectedRole by remember { mutableStateOf(member.parsedRole) }
    var department by remember { mutableStateOf(member.department) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Assign Role: ${member.displayName}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                UserRole.entries.forEach { role ->
                    FilterChip(
                        selected = selectedRole == role,
                        onClick = { selectedRole = role },
                        label = { Text(role.label) },
                    )
                }
                OutlinedTextField(
                    value = department,
                    onValueChange = { department = it },
                    label = { Text("Department") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            Button(onClick = { onSave(selectedRole, department) }) {
                Text("Update Role")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
