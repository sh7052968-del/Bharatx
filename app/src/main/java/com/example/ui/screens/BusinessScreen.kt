package com.example.ui.screens

import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material.icons.filled.Verified
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.UiState
import com.example.model.BusinessOrder
import com.example.model.CatalogItem
import com.example.model.DeterministicRulesEngine
import com.example.model.OrderStatus
import com.example.ui.components.ConnectXEmptyState
import com.example.ui.components.ConnectXErrorBanner
import com.example.ui.components.OrderStatusBadge
import com.example.ui.components.StatusPill
import com.example.ui.components.formatTimestamp
import com.example.ui.i18n.LocalConnectXStrings
import com.example.ui.i18n.ThemeMode
import com.example.viewmodel.ConnectXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BusinessScreen(
    viewModel: ConnectXViewModel,
    modifier: Modifier = Modifier,
) {
    val strings = LocalConnectXStrings.current
    val publicCatalogState by viewModel.publicCatalog.collectAsStateWithLifecycle()
    val myCatalogState by viewModel.myCatalog.collectAsStateWithLifecycle()
    val ordersState by viewModel.orders.collectAsStateWithLifecycle()
    val quickRepliesState by viewModel.quickReplies.collectAsStateWithLifecycle()
    val customerNotesState by viewModel.customerNotes.collectAsStateWithLifecycle()
    val subscriptionState by viewModel.subscription.collectAsStateWithLifecycle()
    val invoicesState by viewModel.invoices.collectAsStateWithLifecycle()
    val ticketsState by viewModel.supportTickets.collectAsStateWithLifecycle()
    val profileState by viewModel.userProfile.collectAsStateWithLifecycle()

    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    var showAddCatalogDialog by remember { mutableStateOf(false) }
    var showAddQuickReplyDialog by remember { mutableStateOf(false) }
    var orderItemTarget by remember { mutableStateOf<CatalogItem?>(null) }

    val profile = (profileState as? UiState.Success)?.data
    val myCatalogList = (myCatalogState as? UiState.Success)?.data ?: emptyList()
    val ordersList = (ordersState as? UiState.Success)?.data ?: emptyList()
    val ticketsList = (ticketsState as? UiState.Success)?.data ?: emptyList()
    val metrics = remember(myCatalogList, ordersList, ticketsList) {
        DeterministicRulesEngine.computeBusinessMetrics(myCatalogList, ordersList, ticketsList)
    }

    val tabTitles = listOf(strings.catalogTab, strings.ordersTab, strings.crmTab, strings.billingTab)

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Business Desk", style = MaterialTheme.typography.titleLarge)
                            if (profile?.verifiedBusiness == true) {
                                Icon(Icons.Filled.Verified, contentDescription = "Verified Business", tint = MaterialTheme.colorScheme.primary)
                            }
                        }
                        Text(
                            profile?.businessName?.ifBlank { "Catalog, Orders, CRM & Billing" } ?: "Catalog, Orders, CRM & Billing",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            when (selectedTab) {
                0 -> FloatingActionButton(
                    onClick = { showAddCatalogDialog = true },
                    modifier = Modifier.testTag("new_catalog_item_fab"),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add Catalog Item")
                }
                2 -> FloatingActionButton(
                    onClick = { showAddQuickReplyDialog = true },
                    modifier = Modifier.testTag("new_quick_reply_fab"),
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "Add Quick Reply")
                }
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
                painter = painterResource(id = R.drawable.img_business_banner_1795598983073),
                contentDescription = "ConnectX Business storefront banner",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .clip(MaterialTheme.shapes.medium),
                contentScale = ContentScale.Crop,
            )
            Spacer(modifier = Modifier.height(10.dp))

            SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                tabTitles.forEachIndexed { index, label ->
                    SegmentedButton(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        shape = SegmentedButtonDefaults.itemShape(index = index, count = tabTitles.size),
                        modifier = Modifier.testTag("business_tab_$index"),
                    ) {
                        Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            when (selectedTab) {
                0 -> CatalogTabContent(
                    publicState = publicCatalogState,
                    myState = myCatalogState,
                    currentUserId = viewModel.currentUserId,
                    onToggleStock = { viewModel.toggleCatalogStock(it) },
                    onOrderClick = { orderItemTarget = it },
                    onAddClick = { showAddCatalogDialog = true },
                )
                1 -> OrdersTabContent(
                    ordersState = ordersState,
                    currentUserId = viewModel.currentUserId,
                    onUpdateStatus = { order, next -> viewModel.updateOrderStatus(order, next) },
                )
                2 -> CrmAndRulesTabContent(
                    profile = profile,
                    metrics = metrics,
                    quickRepliesState = quickRepliesState,
                    customerNotesState = customerNotesState,
                    onSaveBusinessRules = { awayEnabled, awayText, greetingText, bizName, bizCat, verified ->
                        if (profile != null) {
                            viewModel.updateProfilePreferences(
                                displayName = profile.displayName,
                                department = profile.department,
                                presenceStatus = profile.parsedPresence,
                                businessName = bizName,
                                businessCategory = bizCat,
                                awayMessageEnabled = awayEnabled,
                                awayMessageText = awayText,
                                greetingText = greetingText,
                            )
                            viewModel.updateUserSettings(
                                languageCode = profile.languageCode,
                                themeMode = profile.parsedThemeMode,
                                twoFactorEnabled = profile.twoFactorEnabled,
                                notificationsEnabled = profile.notificationsEnabled,
                                lastSeenVisible = profile.lastSeenVisible,
                                verifiedBusiness = verified,
                            )
                        }
                    },
                    onDeleteQuickReply = { viewModel.deleteQuickReply(it) },
                    onAddQuickReply = { showAddQuickReplyDialog = true },
                    onAddCustomerNote = { c, l, n -> viewModel.addCustomerNote(c, l, n) },
                    onDeleteCustomerNote = { viewModel.deleteCustomerNote(it) },
                )
                3 -> BillingTabContent(
                    subscriptionState = subscriptionState,
                    invoicesState = invoicesState,
                    onSelectPlan = { viewModel.changeSubscriptionPlan(it) },
                )
            }
        }
    }

    if (showAddCatalogDialog) {
        AddCatalogItemDialog(
            defaultBusinessName = profile?.businessName?.ifBlank { "ConnectX Merchant" } ?: "ConnectX Merchant",
            onDismiss = { showAddCatalogDialog = false },
            onSave = { biz, name, sku, desc, priceCents, currency, category, vis ->
                viewModel.createCatalogItem(biz, name, sku, desc, priceCents, currency, category, true, vis)
                showAddCatalogDialog = false
            },
        )
    }

    if (showAddQuickReplyDialog) {
        AddQuickReplyDialog(
            onDismiss = { showAddQuickReplyDialog = false },
            onSave = { shortcut, title, body, category ->
                viewModel.createQuickReply(shortcut, title, body, category)
                showAddQuickReplyDialog = false
            },
        )
    }

    orderItemTarget?.let { item ->
        PlaceOrderDialog(
            item = item,
            onDismiss = { orderItemTarget = null },
            onConfirm = { qty ->
                viewModel.placeOrder(item, qty)
                orderItemTarget = null
            },
        )
    }
}

@Composable
private fun CatalogTabContent(
    publicState: UiState<List<CatalogItem>>,
    myState: UiState<List<CatalogItem>>,
    currentUserId: String,
    onToggleStock: (CatalogItem) -> Unit,
    onOrderClick: (CatalogItem) -> Unit,
    onAddClick: () -> Unit,
) {
    var showMineOnly by remember { mutableStateOf(false) }
    var inspectedItem by remember { mutableStateOf<CatalogItem?>(null) }
    Column(modifier = Modifier.fillMaxSize()) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = !showMineOnly,
                onClick = { showMineOnly = false },
                label = { Text("Public Catalog") },
            )
            FilterChip(
                selected = showMineOnly,
                onClick = { showMineOnly = true },
                label = { Text("My Listings") },
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        val activeState = if (showMineOnly) myState else publicState
        when (activeState) {
            is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
            is UiState.Error -> ConnectXErrorBanner(activeState.message)
            is UiState.Success -> {
                if (activeState.data.isEmpty()) {
                    ConnectXEmptyState(
                        icon = Icons.Filled.Storefront,
                        title = "Catalog is empty",
                        subtitle = "Add products or enterprise service packages with deterministic SKU pricing.",
                        actionLabel = "Add Catalog Item",
                        onAction = onAddClick,
                    )
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(bottom = 88.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(activeState.data, key = { it.id }) { item ->
                            Card(
                                modifier = Modifier.clickable { inspectedItem = item },
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(item.name, style = MaterialTheme.typography.titleMedium)
                                            Text(
                                                "${item.businessName} • SKU: ${item.sku}",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            )
                                        }
                                        Text(
                                            text = DeterministicRulesEngine.formatMoney(item.priceCents, item.currency),
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = MaterialTheme.colorScheme.primary,
                                        )
                                    }
                                    if (item.description.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(item.description, style = MaterialTheme.typography.bodyMedium)
                                    }
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        StatusPill(
                                            text = if (item.inStock) "IN STOCK" else "OUT OF STOCK",
                                            containerColor = if (item.inStock) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.errorContainer,
                                            contentColor = if (item.inStock) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onErrorContainer,
                                        )
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            if (item.ownerId == currentUserId) {
                                                OutlinedButton(onClick = { onToggleStock(item) }) {
                                                    Text(if (item.inStock) "Mark Out" else "Restock")
                                                }
                                            }
                                            Button(
                                                onClick = { onOrderClick(item) },
                                                enabled = item.inStock,
                                                modifier = Modifier.testTag("order_item_button_${item.id}"),
                                            ) {
                                                Icon(Icons.Filled.ShoppingCart, contentDescription = "Order", modifier = Modifier.height(16.dp))
                                                Spacer(Modifier.width(6.dp))
                                                Text("Order")
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

    inspectedItem?.let { item ->
        AlertDialog(
            onDismissRequest = { inspectedItem = null },
            title = { Text(item.name) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("${item.businessName} • ${item.category}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Text("SKU: ${item.sku}", style = MaterialTheme.typography.bodySmall)
                    Text("Price: ${DeterministicRulesEngine.formatMoney(item.priceCents, item.currency)}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Status: ${if (item.inStock) "In Stock" else "Out of Stock"}", style = MaterialTheme.typography.bodySmall)
                    if (item.description.isNotBlank()) {
                        Spacer(Modifier.height(4.dp))
                        Text(item.description, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val target = item
                        inspectedItem = null
                        onOrderClick(target)
                    },
                    enabled = item.inStock,
                ) { Text("Order") }
            },
            dismissButton = {
                TextButton(onClick = { inspectedItem = null }) { Text("Close") }
            },
        )
    }
}

@Composable
private fun OrdersTabContent(
    ordersState: UiState<List<BusinessOrder>>,
    currentUserId: String,
    onUpdateStatus: (BusinessOrder, OrderStatus) -> Unit,
) {
    when (ordersState) {
        is UiState.Loading -> Box(Modifier.fillMaxSize(), Alignment.Center) { CircularProgressIndicator() }
        is UiState.Error -> ConnectXErrorBanner(ordersState.message)
        is UiState.Success -> {
            if (ordersState.data.isEmpty()) {
                ConnectXEmptyState(
                    icon = Icons.Filled.ReceiptLong,
                    title = "No orders yet",
                    subtitle = "Orders placed from the Business Catalog appear here with deterministic pricing verification.",
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(bottom = 88.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(ordersState.data, key = { it.id }) { order ->
                        val isMerchant = order.merchantId == currentUserId
                        val isCustomer = order.customerId == currentUserId
                        val status = order.parsedStatus
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(order.itemName, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                                    OrderStatusBadge(status)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Qty: ${order.quantity} × ${DeterministicRulesEngine.formatMoney(order.unitPriceCents)} = ${DeterministicRulesEngine.formatMoney(order.totalCents)}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    "Buyer: ${order.customerName} • ${formatTimestamp(order.createdAt)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                if (status == OrderStatus.PENDING || status == OrderStatus.CONFIRMED) {
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        if (isMerchant && status == OrderStatus.PENDING) {
                                            Button(onClick = { onUpdateStatus(order, OrderStatus.CONFIRMED) }) {
                                                Text("Confirm")
                                            }
                                        }
                                        if (isMerchant && (status == OrderStatus.PENDING || status == OrderStatus.CONFIRMED)) {
                                            OutlinedButton(onClick = { onUpdateStatus(order, OrderStatus.FULFILLED) }) {
                                                Text("Fulfill")
                                            }
                                        }
                                        if ((isCustomer && status == OrderStatus.PENDING) || isMerchant) {
                                            TextButton(onClick = { onUpdateStatus(order, OrderStatus.CANCELLED) }) {
                                                Text("Cancel")
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

@Composable
private fun AddCatalogItemDialog(
    defaultBusinessName: String,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, Long, String, String, String) -> Unit,
) {
    var businessName by remember { mutableStateOf(defaultBusinessName) }
    var name by remember { mutableStateOf("") }
    var sku by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var priceDollars by remember { mutableStateOf("") }
    var currency by remember { mutableStateOf("USD") }
    var category by remember { mutableStateOf("Services") }

    val parsedCents = ((priceDollars.toDoubleOrNull() ?: -1.0) * 100.0).toLong()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Catalog Item") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = businessName, onValueChange = { businessName = it }, label = { Text("Business Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Product / Service Name") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("catalog_name_input"))
                OutlinedTextField(value = sku, onValueChange = { sku = it }, label = { Text("SKU Code") }, singleLine = true, modifier = Modifier.fillMaxWidth().testTag("catalog_sku_input"))
                OutlinedTextField(
                    value = priceDollars,
                    onValueChange = { priceDollars = it },
                    label = { Text("Unit Price (e.g. 49.99)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("catalog_price_input"),
                )
                Row(
                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    listOf("USD", "INR", "EUR", "GBP").forEach { c ->
                        FilterChip(selected = currency == c, onClick = { currency = c }, label = { Text(c) })
                    }
                }
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Description") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(businessName, name, sku, description, parsedCents, currency, category, "PUBLIC_CATALOG")
                },
                enabled = name.isNotBlank() && sku.isNotBlank() && parsedCents >= 0L,
                modifier = Modifier.testTag("confirm_catalog_item_button"),
            ) {
                Text("Publish")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun AddQuickReplyDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, String) -> Unit,
) {
    var shortcut by remember { mutableStateOf("/hours") }
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Support") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Quick-Reply Template") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = shortcut, onValueChange = { shortcut = it }, label = { Text("Shortcut (e.g. /hours)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = body, onValueChange = { body = it }, label = { Text("Template Body") }, minLines = 2, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = category, onValueChange = { category = it }, label = { Text("Category") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(shortcut, title, body, category) },
                enabled = shortcut.trim().length >= 2 && title.isNotBlank() && body.isNotBlank(),
            ) {
                Text("Save")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun PlaceOrderDialog(
    item: CatalogItem,
    onDismiss: () -> Unit,
    onConfirm: (Long) -> Unit,
) {
    var qtyText by remember { mutableStateOf("1") }
    val qty = (qtyText.toLongOrNull() ?: 0L).coerceIn(0L, 1000L)
    val totalCents = if (qty in 1L..1000L) DeterministicRulesEngine.calculateOrderTotalCents(qty, item.priceCents) else 0L

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Place Order") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("${item.name} (${item.sku})", style = MaterialTheme.typography.titleSmall)
                Text("Unit price: ${DeterministicRulesEngine.formatMoney(item.priceCents, item.currency)}")
                OutlinedTextField(
                    value = qtyText,
                    onValueChange = { qtyText = it },
                    label = { Text("Quantity (1 - 1000)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = "Deterministic Total: ${DeterministicRulesEngine.formatMoney(totalCents, item.currency)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold,
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(qty) },
                enabled = qty in 1L..1000L,
            ) {
                Text("Submit Order")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
