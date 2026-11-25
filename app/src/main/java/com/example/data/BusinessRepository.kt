package com.example.data

import com.example.model.BusinessOrder
import com.example.model.CatalogItem
import com.example.model.CustomerNote
import com.example.model.DeterministicRulesEngine
import com.example.model.InvoiceRecord
import com.example.model.OrderStatus
import com.example.model.PlanTier
import com.example.model.QuickReply
import com.example.model.SubscriptionPlanRecord
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.Locale

internal class BusinessRepository(private val scope: RepoScope) {

    fun observePublicCatalog(): Flow<List<CatalogItem>> = flow {
        val uid = scope.requireUserId()
        with(scope) {
            emitAll(
                db.collection("catalog_items")
                    .whereEqualTo("visibility", "PUBLIC_CATALOG")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(CatalogItem::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedBy { it.name.lowercase(Locale.ROOT) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "catalog_items", uid)
            )
        }
    }

    fun observeMyCatalog(userId: String): Flow<List<CatalogItem>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Catalog stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("catalog_items")
                    .whereEqualTo("ownerId", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(CatalogItem::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.updatedAt ?: it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "catalog_items", uid)
            )
        }
    }

    suspend fun createCatalogItem(
        businessName: String,
        name: String,
        sku: String,
        description: String,
        priceCents: Long,
        currency: String,
        category: String,
        inStock: Boolean,
        visibility: String,
        actorName: String,
    ): Result<Unit> {
        var docPath = "catalog_items"
        return try {
            val uid = scope.requireUserId()
            val cleanName = name.trim().take(100)
            val cleanSku = sku.trim().uppercase(Locale.ROOT).take(40)
            require(cleanName.isNotEmpty() && cleanSku.isNotEmpty()) { "Product name and SKU are required." }
            require(priceCents in 0L..100_000_000L) { "Price out of valid range." }
            val safeCurrency = if (currency in listOf("USD", "INR", "EUR", "GBP")) currency else "USD"
            val safeVisibility = if (visibility == "DRAFT") "DRAFT" else "PUBLIC_CATALOG"

            val ref = scope.db.collection("catalog_items").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "ownerId" to uid,
                    "businessName" to businessName.ifBlank { "ConnectX Merchant" }.take(100),
                    "name" to cleanName,
                    "sku" to cleanSku,
                    "description" to description.trim().take(500),
                    "priceCents" to priceCents,
                    "currency" to safeCurrency,
                    "category" to category.ifBlank { "Services" }.take(50),
                    "inStock" to inStock,
                    "visibility" to safeVisibility,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = actorName,
                action = "CATALOG_ITEM_CREATED",
                targetType = "CATALOG_ITEM",
                targetId = ref.id,
                summary = "Added catalog item '$cleanName' ($cleanSku)",
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleCatalogStock(item: CatalogItem): Result<Unit> {
        val docPath = "catalog_items/${item.id}"
        return try {
            scope.requireUserId()
            scope.db.collection("catalog_items").document(item.id).update(
                mapOf(
                    "inStock" to !item.inStock,
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    fun observeOrders(userId: String): Flow<List<BusinessOrder>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Orders stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("orders")
                    .whereArrayContains("memberUids", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(BusinessOrder::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "orders", uid)
            )
        }
    }

    suspend fun placeOrder(
        item: CatalogItem,
        quantity: Long,
        customerName: String,
    ): Result<String> {
        var docPath = "orders"
        return try {
            val uid = scope.requireUserId()
            require(item.inStock) { "Selected item is currently out of stock." }
            val totalCents = DeterministicRulesEngine.calculateOrderTotalCents(quantity, item.priceCents)
            val members = listOf(uid, item.ownerId).distinct().take(5)

            val ref = scope.db.collection("orders").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "customerId" to uid,
                    "customerName" to customerName.ifBlank { "Customer" }.take(80),
                    "merchantId" to item.ownerId,
                    "itemId" to item.id,
                    "itemName" to item.name.take(100),
                    "quantity" to quantity,
                    "unitPriceCents" to item.priceCents,
                    "totalCents" to totalCents,
                    "status" to OrderStatus.PENDING.name,
                    "memberUids" to members,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = customerName,
                action = "ORDER_PLACED",
                targetType = "ORDER",
                targetId = ref.id,
                summary = "Placed order for ${quantity}x '${item.name}' (${DeterministicRulesEngine.formatMoney(totalCents, item.currency)})",
            )
            Result.success(ref.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateOrderStatus(
        order: BusinessOrder,
        nextStatus: OrderStatus,
        actorName: String,
    ): Result<Unit> {
        val docPath = "orders/${order.id}"
        return try {
            val uid = scope.requireUserId()
            require(order.parsedStatus != OrderStatus.FULFILLED && order.parsedStatus != OrderStatus.CANCELLED) {
                "Order is in a terminal state (${order.status})."
            }
            scope.db.collection("orders").document(order.id).update(
                mapOf(
                    "status" to nextStatus.name,
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = actorName,
                action = "ORDER_${nextStatus.name}",
                targetType = "ORDER",
                targetId = order.id,
                summary = "Updated order '${order.itemName}' to ${nextStatus.name}",
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    // --- QUICK REPLIES ---

    fun observeQuickReplies(userId: String): Flow<List<QuickReply>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Quick replies must be scoped to signed-in user." }
        val path = "users/$uid/quick_replies"
        with(scope) {
            emitAll(
                db.collection("users").document(uid).collection("quick_replies")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(QuickReply::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedBy { it.shortcut.lowercase(Locale.ROOT) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun createQuickReply(
        shortcut: String,
        title: String,
        body: String,
        category: String,
    ): Result<Unit> {
        var docPath = "users/unknown/quick_replies"
        return try {
            val uid = scope.requireUserId()
            val cleanShortcut = shortcut.trim().let { if (it.startsWith("/")) it else "/$it" }.take(30)
            val cleanTitle = title.trim().take(80)
            val cleanBody = body.trim().take(1000)
            require(cleanShortcut.length >= 2 && cleanTitle.isNotEmpty() && cleanBody.isNotEmpty()) {
                "Shortcut, title, and template body are required."
            }
            val ref = scope.db.collection("users").document(uid).collection("quick_replies").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "userId" to uid,
                    "shortcut" to cleanShortcut,
                    "title" to cleanTitle,
                    "body" to cleanBody,
                    "category" to category.ifBlank { "General" }.take(40),
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun deleteQuickReply(replyId: String): Result<Unit> {
        var docPath = "users/unknown/quick_replies/$replyId"
        return try {
            val uid = scope.requireUserId()
            val ref = scope.db.collection("users").document(uid).collection("quick_replies").document(replyId)
            docPath = ref.path
            ref.delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docPath)
            Result.failure(e)
        }
    }

    // --- CRM CUSTOMER NOTES ---

    fun observeCustomerNotes(userId: String): Flow<List<CustomerNote>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Customer notes must be scoped to signed-in user." }
        val path = "users/$uid/customer_notes"
        with(scope) {
            emitAll(
                db.collection("users").document(uid).collection("customer_notes")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(CustomerNote::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.updatedAt ?: it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun addCustomerNote(customerName: String, label: String, note: String): Result<Unit> {
        var docPath = "users/unknown/customer_notes"
        return try {
            val uid = scope.requireUserId()
            val cleanCustomer = customerName.trim().take(80)
            val cleanLabel = label.trim().take(30).ifBlank { "VIP" }
            val cleanNote = note.trim().take(400)
            require(cleanCustomer.isNotEmpty() && cleanNote.isNotEmpty()) { "Customer name and note required." }

            val ref = scope.db.collection("users").document(uid).collection("customer_notes").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "userId" to uid,
                    "customerName" to cleanCustomer,
                    "label" to cleanLabel,
                    "note" to cleanNote,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun deleteCustomerNote(noteId: String): Result<Unit> {
        var docPath = "users/unknown/customer_notes/$noteId"
        return try {
            val uid = scope.requireUserId()
            val ref = scope.db.collection("users").document(uid).collection("customer_notes").document(noteId)
            docPath = ref.path
            ref.delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docPath)
            Result.failure(e)
        }
    }

    // --- BILLING & SUBSCRIPTIONS ---

    fun observeSubscription(userId: String): Flow<SubscriptionPlanRecord?> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Subscription must be scoped to signed-in user." }
        val path = "users/$uid/subscription/current"
        with(scope) {
            emitAll(
                db.collection("users").document(uid).collection("subscription").document("current")
                    .snapshots()
                    .map { snap ->
                        snap.toObject(SubscriptionPlanRecord::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                    }
                    .handleFirestoreStreamError(OperationType.GET, path, uid)
            )
        }
    }

    fun observeInvoices(userId: String): Flow<List<InvoiceRecord>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Invoices must be scoped to signed-in user." }
        val path = "users/$uid/invoices"
        with(scope) {
            emitAll(
                db.collection("users").document(uid).collection("invoices")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(InvoiceRecord::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun changeSubscriptionPlan(tier: PlanTier, actorName: String): Result<Unit> {
        var docPath = "users/unknown/subscription/current"
        return try {
            val uid = scope.requireUserId()
            val subRef = scope.db.collection("users").document(uid).collection("subscription").document("current")
            docPath = subRef.path
            val snap = subRef.get().await()
            if (!snap.exists()) {
                subRef.set(
                    mapOf(
                        "userId" to uid,
                        "planId" to tier.name,
                        "planName" to tier.title,
                        "monthlyPriceCents" to tier.monthlyPriceCents,
                        "status" to "ACTIVE",
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
            } else {
                subRef.update(
                    mapOf(
                        "planId" to tier.name,
                        "planName" to tier.title,
                        "monthlyPriceCents" to tier.monthlyPriceCents,
                        "status" to "ACTIVE",
                        "updatedAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
            }

            if (tier.monthlyPriceCents > 0L) {
                val invRef = scope.db.collection("users").document(uid).collection("invoices").document()
                val invNo = "INV-${System.currentTimeMillis().toString().takeLast(6)}"
                invRef.set(
                    mapOf(
                        "userId" to uid,
                        "invoiceNumber" to invNo,
                        "planName" to tier.title,
                        "amountCents" to tier.monthlyPriceCents,
                        "status" to "PAID",
                        "createdAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
            }

            scope.recordAuditLog(
                actorId = uid,
                actorName = actorName,
                action = "PLAN_UPDATED",
                targetType = "SUBSCRIPTION",
                targetId = tier.name,
                summary = "Switched workspace billing plan to ${tier.title}",
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }
}
