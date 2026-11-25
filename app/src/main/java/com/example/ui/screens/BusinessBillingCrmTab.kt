package com.example.ui.screens

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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Workspaces
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.data.UiState
import com.example.model.BusinessMetrics
import com.example.model.CustomerNote
import com.example.model.DeterministicRulesEngine
import com.example.model.InvoiceRecord
import com.example.model.PlanTier
import com.example.model.QuickReply
import com.example.model.SubscriptionPlanRecord
import com.example.model.UserProfile
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.ui.i18n.LocalConnectXStrings

@Composable
fun CrmAndRulesTabContent(
    profile: UserProfile?,
    metrics: BusinessMetrics,
    quickRepliesState: UiState<List<QuickReply>>,
    customerNotesState: UiState<List<CustomerNote>>,
    onSaveBusinessRules: (Boolean, String, String, String, String, Boolean) -> Unit,
    onDeleteQuickReply: (String) -> Unit,
    onAddQuickReply: () -> Unit,
    onAddCustomerNote: (String, String, String) -> Unit,
    onDeleteCustomerNote: (String) -> Unit,
) {
    var businessName by remember(profile?.businessName) { mutableStateOf(profile?.businessName ?: "") }
    var businessCategory by remember(profile?.businessCategory) { mutableStateOf(profile?.businessCategory ?: "") }
    var verifiedBusiness by remember(profile?.verifiedBusiness) { mutableStateOf(profile?.verifiedBusiness ?: false) }
    var awayEnabled by remember(profile?.awayMessageEnabled) { mutableStateOf(profile?.awayMessageEnabled ?: false) }
    var awayText by remember(profile?.awayMessageText) { mutableStateOf(profile?.awayMessageText ?: "") }
    var greetingText by remember(profile?.greetingText) { mutableStateOf(profile?.greetingText ?: "") }
    var showAddNoteDialog by remember { mutableStateOf(false) }

    LazyColumn(
        contentPadding = PaddingValues(bottom = 88.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f))) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Deterministic Business Analytics", style = MaterialTheme.typography.titleMedium)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("Order Volume", style = MaterialTheme.typography.labelSmall)
                            Text(DeterministicRulesEngine.formatMoney(metrics.revenueCents), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                        }
                        Column {
                            Text("Fulfilled Orders", style = MaterialTheme.typography.labelSmall)
                            Text("${metrics.fulfilledOrdersCount} / ${metrics.totalOrdersCount}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        }
                        Column {
                            Text("In-Stock SKUs", style = MaterialTheme.typography.labelSmall)
                            Text("${metrics.inStockCount} / ${metrics.totalCatalogCount}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Business Registration & Rules", style = MaterialTheme.typography.titleMedium)
                            if (verifiedBusiness) {
                                Spacer(Modifier.width(6.dp))
                                Icon(Icons.Filled.Verified, contentDescription = "Verified", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                    OutlinedTextField(value = businessName, onValueChange = { businessName = it }, label = { Text("Registered Business Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = businessCategory, onValueChange = { businessCategory = it }, label = { Text("Business Category") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Verified Business Badge", style = MaterialTheme.typography.bodyMedium)
                        Switch(checked = verifiedBusiness, onCheckedChange = { verifiedBusiness = it })
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Deterministic Away Rule", style = MaterialTheme.typography.titleSmall)
                            Text("Fixed template reply on Support threads (no AI).", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(checked = awayEnabled, onCheckedChange = { awayEnabled = it })
                    }
                    OutlinedTextField(value = awayText, onValueChange = { awayText = it }, label = { Text("Away Message Template") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = greetingText, onValueChange = { greetingText = it }, label = { Text("Predefined Greeting Text") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = { onSaveBusinessRules(awayEnabled, awayText, greetingText, businessName, businessCategory, verifiedBusiness) },
                        enabled = profile != null,
                        modifier = Modifier.align(Alignment.End),
                    ) { Text("Save Business & Rules") }
                }
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("CRM Customer Labels & Notes", style = MaterialTheme.typography.titleMedium)
                OutlinedButton(onClick = { showAddNoteDialog = true }, modifier = Modifier.testTag("add_crm_note_button")) {
                    Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add Note")
                }
            }
        }

        when (customerNotesState) {
            is UiState.Loading -> item { CircularProgressIndicator() }
            is UiState.Error -> item { ConnectXErrorBanner(customerNotesState.message) }
            is UiState.Success -> {
                if (customerNotesState.data.isEmpty()) {
                    item {
                        ConnectXEmptyState(
                            icon = Icons.Filled.Workspaces,
                            title = "No CRM customer notes yet",
                            subtitle = "Track VIP customer labels, SLA terms, and account notes.",
                            actionLabel = "Add Customer Note",
                            onAction = { showAddNoteDialog = true },
                        )
                    }
                } else {
                    items(customerNotesState.data, key = { it.id }) { cn ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                            Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Text(cn.customerName, style = MaterialTheme.typography.titleSmall)
                                        StatusPill(cn.label, MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
                                    }
                                    Spacer(Modifier.height(4.dp))
                                    Text(cn.note, style = MaterialTheme.typography.bodySmall)
                                }
                                IconButton(onClick = { onDeleteCustomerNote(cn.id) }) {
                                    Icon(Icons.Filled.Delete, contentDescription = "Delete CRM note")
                                }
                            }
                        }
                    }
                }
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Quick-Reply Shortcuts (/command)", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = onAddQuickReply) { Text("Add") }
            }
        }

        when (quickRepliesState) {
            is UiState.Loading -> item { CircularProgressIndicator() }
            is UiState.Error -> item { ConnectXErrorBanner(quickRepliesState.message) }
            is UiState.Success -> {
                items(quickRepliesState.data, key = { it.id }) { qr ->
                    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                        Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    StatusPill(qr.shortcut, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                                    Text(qr.title, style = MaterialTheme.typography.titleSmall)
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(qr.body, style = MaterialTheme.typography.bodySmall)
                            }
                            IconButton(onClick = { onDeleteQuickReply(qr.id) }) {
                                Icon(Icons.Filled.Delete, contentDescription = "Delete quick reply")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddNoteDialog) {
        var customer by remember { mutableStateOf("") }
        var label by remember { mutableStateOf("VIP") }
        var note by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showAddNoteDialog = false },
            title = { Text("Add Customer CRM Note") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = customer, onValueChange = { customer = it }, label = { Text("Customer / Account Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = label, onValueChange = { label = it }, label = { Text("Label (e.g. VIP, Wholesale)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("CRM Note") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                }
            },
            confirmButton = {
                Button(
                    onClick = { onAddCustomerNote(customer, label, note); showAddNoteDialog = false },
                    enabled = customer.isNotBlank() && note.isNotBlank(),
                ) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { showAddNoteDialog = false }) { Text("Cancel") } },
        )
    }
}

@Composable
fun BillingTabContent(
    subscriptionState: UiState<SubscriptionPlanRecord?>,
    invoicesState: UiState<List<InvoiceRecord>>,
    onSelectPlan: (PlanTier) -> Unit,
) {
    val strings = LocalConnectXStrings.current
    val currentSub = (subscriptionState as? UiState.Success)?.data
    val activeTier = currentSub?.parsedTier ?: PlanTier.STARTER

    LazyColumn(
        contentPadding = PaddingValues(bottom = 88.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Text(strings.subscriptionPlansTitle, style = MaterialTheme.typography.titleMedium)
        }

        items(PlanTier.entries, key = { it.name }) { tier ->
            val isCurrent = tier == activeTier
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isCurrent) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)
                    else MaterialTheme.colorScheme.surfaceContainerLowest,
                ),
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tier.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Text(tier.tagline, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(
                            text = if (tier.monthlyPriceCents == 0L) "Free" else "${DeterministicRulesEngine.formatMoney(tier.monthlyPriceCents)}/mo",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    tier.features.forEach { feat ->
                        Text("• $feat", style = MaterialTheme.typography.bodySmall)
                    }
                    Spacer(Modifier.height(4.dp))
                    if (isCurrent) {
                        StatusPill("ACTIVE PLAN", MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.onPrimary)
                    } else {
                        Button(
                            onClick = { onSelectPlan(tier) },
                            modifier = Modifier.testTag("select_plan_${tier.name}"),
                        ) {
                            Text(if (tier.ordinal > activeTier.ordinal) "Upgrade to ${tier.title}" else "Switch to ${tier.title}")
                        }
                    }
                }
            }
        }

        item {
            Text(strings.invoicesTitle, style = MaterialTheme.typography.titleMedium)
        }

        when (invoicesState) {
            is UiState.Loading -> item { Box(Modifier.fillMaxWidth(), Alignment.Center) { CircularProgressIndicator() } }
            is UiState.Error -> item { ConnectXErrorBanner(invoicesState.message) }
            is UiState.Success -> {
                if (invoicesState.data.isEmpty()) {
                    item {
                        ConnectXEmptyState(
                            icon = Icons.Filled.Receipt,
                            title = "No billing invoices yet",
                            subtitle = "Paid plan upgrades generate verifiable invoice records here.",
                        )
                    }
                } else {
                    items(invoicesState.data, key = { it.id }) { inv ->
                        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest)) {
                            Row(modifier = Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column {
                                    Text("${inv.invoiceNumber} • ${inv.planName}", style = MaterialTheme.typography.titleSmall)
                                    Text(formatTimestamp(inv.createdAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(DeterministicRulesEngine.formatMoney(inv.amountCents), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    StatusPill(inv.status, MaterialTheme.colorScheme.tertiaryContainer, MaterialTheme.colorScheme.onTertiaryContainer)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
