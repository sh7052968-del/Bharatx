package com.example.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Devices
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.credentials.CredentialManager
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.UiState
import com.example.data.signOut
import com.example.model.PresenceStatus
import com.example.ui.components.AvatarCircle
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.RoleBadge
import com.example.ui.components.StatusPill
import com.example.ui.i18n.AppLanguage
import com.example.ui.i18n.LocalConnectXStrings
import com.example.ui.i18n.ThemeMode
import com.example.viewmodel.ConnectXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    viewModel: ConnectXViewModel,
    modifier: Modifier = Modifier,
    showTopBar: Boolean = true,
) {
    val strings = LocalConnectXStrings.current
    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()
    val devicesState by viewModel.devices.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember(context) { CredentialManager.create(context) }

    var showChangelogDialog by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        contentWindowInsets = if (showTopBar) androidx.compose.material3.ScaffoldDefaults.contentWindowInsets else androidx.compose.foundation.layout.WindowInsets(0, 0, 0, 0),
        topBar = {
            if (showTopBar) {
                TopAppBar(
                    title = {
                        Column {
                            Text(strings.settingsTab, style = MaterialTheme.typography.titleLarge)
                            Text(
                                "Identity, Theme, Language & Security",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                )
            }
        },
    ) { padding ->
        when (val state = profileState) {
            is UiState.Loading -> Box(Modifier.fillMaxSize().padding(padding), Alignment.Center) { CircularProgressIndicator() }
            is UiState.Error -> ConnectXErrorBanner(state.message, Modifier.padding(padding).padding(16.dp))
            is UiState.Success -> {
                val profile = state.data
                var displayName by remember(profile?.displayName) { mutableStateOf(profile?.displayName ?: "") }
                var department by remember(profile?.department) { mutableStateOf(profile?.department ?: "General") }
                var businessName by remember(profile?.businessName) { mutableStateOf(profile?.businessName ?: "") }
                var businessCategory by remember(profile?.businessCategory) { mutableStateOf(profile?.businessCategory ?: "") }
                var presence by remember(profile?.presenceStatus) { mutableStateOf(profile?.parsedPresence ?: PresenceStatus.ONLINE) }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (profile != null) {
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                            Row(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                AvatarCircle(name = profile.displayName, size = 56.dp, presence = presence)
                                Spacer(Modifier.width(14.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(profile.displayName, style = MaterialTheme.typography.titleLarge)
                                    Text(profile.email, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Spacer(Modifier.height(6.dp))
                                    RoleBadge(profile.parsedRole)
                                }
                            }
                        }

                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("${strings.languageLabel} & ${strings.themeLabel}", style = MaterialTheme.typography.titleMedium)
                                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    AppLanguage.entries.forEach { lang ->
                                        FilterChip(
                                            selected = profile.languageCode == lang.code,
                                            onClick = {
                                                viewModel.updateUserSettings(
                                                    languageCode = lang.code,
                                                    themeMode = profile.parsedThemeMode,
                                                    twoFactorEnabled = profile.twoFactorEnabled,
                                                    notificationsEnabled = profile.notificationsEnabled,
                                                    lastSeenVisible = profile.lastSeenVisible,
                                                    verifiedBusiness = profile.verifiedBusiness,
                                                )
                                            },
                                            label = { Text(lang.nativeLabel) },
                                            modifier = Modifier.testTag("lang_chip_${lang.code}"),
                                        )
                                    }
                                }
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    ThemeMode.entries.forEach { mode ->
                                        FilterChip(
                                            selected = profile.parsedThemeMode == mode,
                                            onClick = {
                                                viewModel.updateUserSettings(
                                                    languageCode = profile.languageCode,
                                                    themeMode = mode,
                                                    twoFactorEnabled = profile.twoFactorEnabled,
                                                    notificationsEnabled = profile.notificationsEnabled,
                                                    lastSeenVisible = profile.lastSeenVisible,
                                                    verifiedBusiness = profile.verifiedBusiness,
                                                )
                                            },
                                            label = { Text(mode.label) },
                                            modifier = Modifier.testTag("theme_chip_${mode.name}"),
                                        )
                                    }
                                }
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(strings.securityLabel, style = MaterialTheme.typography.bodyMedium)
                                    Switch(
                                        checked = profile.twoFactorEnabled,
                                        onCheckedChange = { enabled ->
                                            viewModel.updateUserSettings(profile.languageCode, profile.parsedThemeMode, enabled, profile.notificationsEnabled, profile.lastSeenVisible, profile.verifiedBusiness)
                                        },
                                    )
                                }
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(strings.privacyLabel, style = MaterialTheme.typography.bodyMedium)
                                    Switch(
                                        checked = profile.lastSeenVisible,
                                        onCheckedChange = { visible ->
                                            viewModel.updateUserSettings(profile.languageCode, profile.parsedThemeMode, profile.twoFactorEnabled, profile.notificationsEnabled, visible, profile.verifiedBusiness)
                                        },
                                    )
                                }
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text("Push & Desk Alerts", style = MaterialTheme.typography.bodyMedium)
                                    Switch(
                                        checked = profile.notificationsEnabled,
                                        onCheckedChange = { alerts ->
                                            viewModel.updateUserSettings(profile.languageCode, profile.parsedThemeMode, profile.twoFactorEnabled, alerts, profile.lastSeenVisible, profile.verifiedBusiness)
                                        },
                                    )
                                }
                            }
                        }

                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Presence & Profile Identity", style = MaterialTheme.typography.titleMedium)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    PresenceStatus.entries.forEach { status ->
                                        FilterChip(selected = presence == status, onClick = { presence = status }, label = { Text(status.label) })
                                    }
                                }
                                OutlinedTextField(value = displayName, onValueChange = { displayName = it }, label = { Text("Display Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                                OutlinedTextField(value = department, onValueChange = { department = it }, label = { Text("Department") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                                OutlinedTextField(value = businessName, onValueChange = { businessName = it }, label = { Text("Business / Storefront Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                                OutlinedTextField(value = businessCategory, onValueChange = { businessCategory = it }, label = { Text("Business Category") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                                Button(
                                    onClick = {
                                        viewModel.updateProfilePreferences(
                                            displayName, department, presence, businessName, businessCategory,
                                            profile.awayMessageEnabled, profile.awayMessageText, profile.greetingText,
                                        )
                                    },
                                    enabled = displayName.isNotBlank(),
                                    modifier = Modifier.align(Alignment.End).testTag("save_profile_button"),
                                ) { Text(strings.save) }
                            }
                        }

                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Filled.Devices, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                    Spacer(Modifier.width(8.dp))
                                    Text(strings.devicesLabel, style = MaterialTheme.typography.titleMedium)
                                }
                                when (val devState = devicesState) {
                                    is UiState.Loading -> CircularProgressIndicator(modifier = Modifier.size(20.dp))
                                    is UiState.Error -> Text(devState.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                                    is UiState.Success -> {
                                        if (devState.data.isEmpty()) {
                                            Text("No active sessions recorded.", style = MaterialTheme.typography.bodySmall)
                                        } else {
                                            devState.data.forEach { dev ->
                                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                                    Column(modifier = Modifier.weight(1f)) {
                                                        Text(dev.deviceName, style = MaterialTheme.typography.titleSmall)
                                                        Text(dev.platform, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                                    }
                                                    if (dev.id == "android_primary") {
                                                        StatusPill("THIS DEVICE", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                                    } else {
                                                        TextButton(onClick = { viewModel.revokeDevice(dev.id) }) { Text("Revoke") }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.VerifiedUser, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(8.dp))
                                Text("AI-Free Deterministic Platform", style = MaterialTheme.typography.titleSmall)
                            }
                            Text(
                                "ConnectX runs purely deterministic SLA triage, arithmetic order verification, and zero-trust Firestore rules with zero AI or ML integrations.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            OutlinedButton(onClick = { showChangelogDialog = true }, modifier = Modifier.testTag("open_changelog_button")) {
                                Icon(Icons.Filled.Description, contentDescription = null)
                                Spacer(Modifier.width(8.dp))
                                Text("Architecture & Changelog (v2.0.0)")
                            }
                        }
                    }

                    OutlinedButton(
                        onClick = { showDeleteConfirm = true },
                        modifier = Modifier.fillMaxWidth().testTag("delete_account_data_button"),
                    ) {
                        Icon(Icons.Filled.DeleteForever, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.width(8.dp))
                        Text(strings.deleteAccountData, color = MaterialTheme.colorScheme.error)
                    }

                    Button(
                        onClick = { signOut(credentialManager = credentialManager, scope = scope) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer,
                            contentColor = MaterialTheme.colorScheme.onErrorContainer,
                        ),
                        modifier = Modifier.fillMaxWidth().height(50.dp).testTag("sign_out_button"),
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = strings.signOut)
                        Spacer(Modifier.width(8.dp))
                        Text(strings.signOut)
                    }
                }
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text(strings.deleteAccountData) },
            text = { Text("This permanently deletes your personal contacts, quick replies, CRM notes, and registered device sessions and signs you out.") },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteConfirm = false
                        viewModel.deleteOwnAccountData {
                            signOut(credentialManager = credentialManager, scope = scope)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError),
                ) { Text("Purge & Sign Out") }
            },
            dismissButton = { TextButton(onClick = { showDeleteConfirm = false }) { Text(strings.cancel) } },
        )
    }

    if (showChangelogDialog) {
        AlertDialog(
            onDismissRequest = { showChangelogDialog = false },
            title = { Text("ConnectX v2.0.0 Architecture & Changelog") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("• Dashboard: Global search, notification center, online contacts & activity", style = MaterialTheme.typography.bodySmall)
                    Text("• Messaging: Reply, forward, edit, delete, reactions, pin, star, voice & file attachments, archive/mute/disappearing", style = MaterialTheme.typography.bodySmall)
                    Text("• Hub: Personal contacts, Voice/Video/Group calling, Status updates & Channels", style = MaterialTheme.typography.bodySmall)
                    Text("• Business & Billing: Verified desk, CRM notes, deterministic analytics, plans & invoices", style = MaterialTheme.typography.bodySmall)
                    Text("• Settings & Support: EN/HI/AS i18n, Light/Dark/System themes, devices, 2FA, Help Center & Tickets", style = MaterialTheme.typography.bodySmall)
                }
            },
            confirmButton = { TextButton(onClick = { showChangelogDialog = false }) { Text(strings.close) } },
        )
    }
}
