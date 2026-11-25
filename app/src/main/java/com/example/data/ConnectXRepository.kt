package com.example.data

import android.content.Context
import android.os.Build
import com.example.R
import com.example.model.AuditLog
import com.example.model.BroadcastChannel
import com.example.model.BusinessOrder
import com.example.model.CallSession
import com.example.model.CallStatus
import com.example.model.CallType
import com.example.model.CatalogItem
import com.example.model.ChannelCategory
import com.example.model.ChannelPost
import com.example.model.ChatMessage
import com.example.model.ContactEntry
import com.example.model.Conversation
import com.example.model.ConversationStatus
import com.example.model.ConversationType
import com.example.model.CustomerNote
import com.example.model.DeterministicRulesEngine
import com.example.model.DeviceSession
import com.example.model.DirectoryMember
import com.example.model.InvoiceRecord
import com.example.model.MessageType
import com.example.model.OrderStatus
import com.example.model.PlanTier
import com.example.model.PresenceStatus
import com.example.model.PriorityLevel
import com.example.model.QuickReply
import com.example.model.StatusMediaType
import com.example.model.StatusUpdate
import com.example.model.SubscriptionPlanRecord
import com.example.model.SupportTicket
import com.example.model.TicketStatus
import com.example.model.UserProfile
import com.example.model.UserRole
import com.example.ui.i18n.AppLanguage
import com.example.ui.i18n.ThemeMode
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.Locale

class ConnectXRepository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth = Firebase.auth,
) {
    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private val scope = RepoScope(db, auth)
    private val messaging = MessagingRepository(scope)
    private val community = CommunityRepository(scope)
    private val business = BusinessRepository(scope)

    // --- USER PROVISIONING, SETTINGS & DEVICES ---

    suspend fun ensureUserProvisioned(firebaseUser: FirebaseUser): Result<Unit> {
        val uid = firebaseUser.uid
        val userPath = "users/$uid"
        return try {
            require(uid.isNotBlank()) { "Authenticated UID missing." }
            val email = (firebaseUser.email ?: "member@connectx.local").trim().take(150)
            val displayName = (firebaseUser.displayName ?: email.substringBefore("@"))
                .ifBlank { "ConnectX Member" }
                .take(80)
            val isBootstrap = firebaseUser.isEmailVerified &&
                email.equals(BOOTSTRAP_ADMIN_EMAIL, ignoreCase = true)
            val initialRole = if (isBootstrap) UserRole.ADMIN.name else UserRole.MEMBER.name

            val userRef = db.collection("users").document(uid)
            if (!userRef.get().await().exists()) {
                userRef.set(
                    mapOf(
                        "userId" to uid,
                        "displayName" to displayName,
                        "email" to email,
                        "role" to initialRole,
                        "department" to if (isBootstrap) "Executive Operations" else "General",
                        "presenceStatus" to PresenceStatus.ONLINE.name,
                        "businessName" to "$displayName Workspace",
                        "businessCategory" to "Enterprise Services",
                        "verifiedBusiness" to false,
                        "awayMessageEnabled" to false,
                        "awayMessageText" to "Thanks for messaging us. Our desk is currently offline and will reply shortly.",
                        "greetingText" to "Welcome to ConnectX Business Desk. Use /hours or /pricing for instant details.",
                        "languageCode" to AppLanguage.EN.code,
                        "themeMode" to ThemeMode.SYSTEM.name,
                        "twoFactorEnabled" to false,
                        "notificationsEnabled" to true,
                        "lastSeenVisible" to true,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
            }

            if (isBootstrap) {
                val adminRef = db.collection("admins").document(uid)
                if (!adminRef.get().await().exists()) {
                    adminRef.set(
                        mapOf(
                            "userId" to uid,
                            "grantedBy" to uid,
                            "createdAt" to FieldValue.serverTimestamp(),
                        )
                    ).await()
                }
            }

            val dirRef = db.collection("directory_profiles").document(uid)
            if (!dirRef.get().await().exists()) {
                val handle = displayName.lowercase(Locale.ROOT)
                    .replace(Regex("[^a-z0-9]"), "")
                    .ifBlank { "member" }
                    .take(24) + "_" + uid.take(4)
                dirRef.set(
                    mapOf(
                        "userId" to uid,
                        "displayName" to displayName,
                        "handle" to handle,
                        "department" to if (isBootstrap) "Executive Operations" else "General",
                        "presenceStatus" to PresenceStatus.ONLINE.name,
                        "role" to initialRole,
                        "workspaceScope" to WORKSPACE_SCOPE,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
            }

            val deviceRef = userRef.collection("devices").document("android_primary")
            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim().ifBlank { "Android Device" }.take(80)
            val platform = "Android ${Build.VERSION.RELEASE ?: ""}".trim().take(40)
            if (!deviceRef.get().await().exists()) {
                deviceRef.set(
                    mapOf(
                        "userId" to uid,
                        "deviceName" to deviceName,
                        "platform" to platform,
                        "trusted" to true,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp(),
                    )
                ).await()
            }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.WRITE, userPath)
            Result.failure(e)
        }
    }

    fun observeUserProfile(userId: String): Flow<UserProfile?> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Profile stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("users").document(uid).snapshots()
                    .map { it.toObject(UserProfile::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE) }
                    .handleFirestoreStreamError(OperationType.GET, "users/$uid", uid)
            )
        }
    }

    fun observeDirectoryMembers(): Flow<List<DirectoryMember>> = flow {
        val uid = scope.requireUserId()
        with(scope) {
            emitAll(
                db.collection("directory_profiles")
                    .whereEqualTo("workspaceScope", WORKSPACE_SCOPE)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(DirectoryMember::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedBy { it.displayName.lowercase(Locale.ROOT) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "directory_profiles", uid)
            )
        }
    }

    suspend fun updateProfilePreferences(
        displayName: String,
        department: String,
        presenceStatus: PresenceStatus,
        businessName: String,
        businessCategory: String,
        awayMessageEnabled: Boolean,
        awayMessageText: String,
        greetingText: String,
    ): Result<Unit> {
        var docPath = "users/unknown"
        return try {
            val uid = scope.requireUserId()
            val cleanName = displayName.trim().take(80)
            require(cleanName.isNotEmpty()) { "Display name cannot be empty." }
            val cleanDept = department.trim().take(60)
            val userRef = db.collection("users").document(uid)
            docPath = userRef.path
            userRef.update(
                mapOf(
                    "displayName" to cleanName,
                    "department" to cleanDept,
                    "presenceStatus" to presenceStatus.name,
                    "businessName" to businessName.trim().take(100),
                    "businessCategory" to businessCategory.trim().take(60),
                    "awayMessageEnabled" to awayMessageEnabled,
                    "awayMessageText" to awayMessageText.trim().take(300),
                    "greetingText" to greetingText.trim().take(300),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            db.collection("directory_profiles").document(uid).update(
                mapOf(
                    "displayName" to cleanName,
                    "department" to cleanDept,
                    "presenceStatus" to presenceStatus.name,
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

    suspend fun updateUserSettings(
        languageCode: String,
        themeMode: ThemeMode,
        twoFactorEnabled: Boolean,
        notificationsEnabled: Boolean,
        lastSeenVisible: Boolean,
        verifiedBusiness: Boolean,
    ): Result<Unit> {
        var docPath = "users/unknown"
        return try {
            val uid = scope.requireUserId()
            val safeLang = AppLanguage.fromCode(languageCode).code
            val userRef = db.collection("users").document(uid)
            docPath = userRef.path
            userRef.update(
                mapOf(
                    "languageCode" to safeLang,
                    "themeMode" to themeMode.name,
                    "twoFactorEnabled" to twoFactorEnabled,
                    "notificationsEnabled" to notificationsEnabled,
                    "lastSeenVisible" to lastSeenVisible,
                    "verifiedBusiness" to verifiedBusiness,
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

    fun observeDevices(userId: String): Flow<List<DeviceSession>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Devices must be scoped to signed-in user." }
        val path = "users/$uid/devices"
        with(scope) {
            emitAll(
                db.collection("users").document(uid).collection("devices")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(DeviceSession::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.updatedAt ?: it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun revokeDevice(deviceId: String): Result<Unit> {
        var docPath = "users/unknown/devices/$deviceId"
        return try {
            val uid = scope.requireUserId()
            val ref = db.collection("users").document(uid).collection("devices").document(deviceId)
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

    suspend fun deleteOwnAccountData(actorName: String): Result<Unit> {
        var docPath = "users/unknown"
        return try {
            val uid = scope.requireUserId()
            val userRef = db.collection("users").document(uid)
            docPath = userRef.path
            for (sub in listOf("quick_replies", "contacts", "devices", "customer_notes")) {
                val snap = userRef.collection(sub).get().await()
                for (doc in snap.documents) {
                    doc.reference.delete().await()
                }
            }
            userRef.update(
                mapOf(
                    "presenceStatus" to PresenceStatus.AWAY.name,
                    "awayMessageEnabled" to false,
                    "businessName" to "",
                    "businessCategory" to "",
                    "verifiedBusiness" to false,
                    "twoFactorEnabled" to false,
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            scope.recordAuditLog(
                actorId = uid,
                actorName = actorName,
                action = "ACCOUNT_DATA_PURGED",
                targetType = "USER",
                targetId = uid,
                summary = "User purged personal contacts, CRM notes, quick replies, and device sessions",
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docPath)
            Result.failure(e)
        }
    }

    // --- SUPPORT TICKETS ---

    fun observeSupportTickets(userId: String, isAdmin: Boolean): Flow<List<SupportTicket>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Support ticket stream must match signed-in user." }
        val query = if (isAdmin) {
            db.collection("support_tickets")
        } else {
            db.collection("support_tickets").whereEqualTo("userId", uid)
        }
        with(scope) {
            emitAll(
                query.snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(SupportTicket::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "support_tickets", uid)
            )
        }
    }

    suspend fun createSupportTicket(
        userName: String,
        subject: String,
        category: String,
        description: String,
    ): Result<String> {
        var docPath = "support_tickets"
        return try {
            val uid = scope.requireUserId()
            val cleanSubj = subject.trim().take(120)
            val cleanDesc = description.trim().take(2000)
            val cleanCat = category.trim().ifBlank { "General" }.take(50)
            require(cleanSubj.length >= 2 && cleanDesc.length >= 2) { "Subject and description required." }
            val priority = DeterministicRulesEngine.classifySupportPriority(cleanSubj, cleanDesc)

            val ref = db.collection("support_tickets").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "userId" to uid,
                    "userName" to userName.ifBlank { "Member" }.take(80),
                    "subject" to cleanSubj,
                    "category" to cleanCat,
                    "description" to cleanDesc,
                    "priority" to priority.name,
                    "status" to TicketStatus.OPEN.name,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = userName,
                action = "TICKET_CREATED",
                targetType = "SUPPORT_TICKET",
                targetId = ref.id,
                summary = "Filed ticket '$cleanSubj' (${priority.label} priority)",
            )
            Result.success(ref.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateSupportTicketStatus(ticket: SupportTicket, nextStatus: TicketStatus): Result<Unit> {
        val docPath = "support_tickets/${ticket.id}"
        return try {
            scope.requireUserId()
            require(ticket.parsedStatus != TicketStatus.RESOLVED) { "Resolved tickets cannot be changed." }
            db.collection("support_tickets").document(ticket.id).update(
                mapOf("status" to nextStatus.name, "updatedAt" to FieldValue.serverTimestamp())
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    // --- GOVERNANCE & AUDIT ---

    fun observeAuditLogs(userId: String, isAdmin: Boolean): Flow<List<AuditLog>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Audit log stream must match signed-in user." }
        val query = if (isAdmin) db.collection("audit_logs") else db.collection("audit_logs").whereEqualTo("actorId", uid)
        with(scope) {
            emitAll(
                query.snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(AuditLog::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "audit_logs", uid)
            )
        }
    }

    suspend fun updateMemberRoleByAdmin(
        targetUserId: String,
        newRole: UserRole,
        department: String,
        actorName: String,
    ): Result<Unit> {
        val docPath = "users/$targetUserId"
        return try {
            val uid = scope.requireUserId()
            val cleanDept = department.trim().take(60)
            db.collection("users").document(targetUserId).update(
                mapOf("role" to newRole.name, "department" to cleanDept, "updatedAt" to FieldValue.serverTimestamp())
            ).await()
            db.collection("directory_profiles").document(targetUserId).update(
                mapOf("role" to newRole.name, "department" to cleanDept, "updatedAt" to FieldValue.serverTimestamp())
            ).await()

            val adminDoc = db.collection("admins").document(targetUserId)
            if (newRole == UserRole.ADMIN) {
                if (!adminDoc.get().await().exists()) {
                    adminDoc.set(mapOf("userId" to targetUserId, "grantedBy" to uid, "createdAt" to FieldValue.serverTimestamp())).await()
                }
            } else if (targetUserId != uid && adminDoc.get().await().exists()) {
                adminDoc.delete().await()
            }

            scope.recordAuditLog(
                actorId = uid,
                actorName = actorName,
                action = "ROLE_UPDATED",
                targetType = "USER",
                targetId = targetUserId,
                summary = "Assigned role ${newRole.name} ($cleanDept)",
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    // --- DELEGATED STREAMS & MUTATIONS ---

    fun observeConversations(userId: String): Flow<List<Conversation>> = messaging.observeConversations(userId)
    fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = messaging.observeMessages(conversationId)
    suspend fun createConversation(
        title: String, type: ConversationType, participantUids: List<String>,
        initialMessage: String, senderName: String, labels: List<String> = emptyList(),
    ) = messaging.createConversation(title, type, participantUids, initialMessage, senderName, labels)

    suspend fun sendMessage(
        conversation: Conversation, senderName: String, body: String,
        messageType: MessageType = MessageType.TEXT, orderTotalCents: Long? = null,
        attachmentNote: String? = null, replyPreview: String? = null, voiceDurationSec: Long? = null,
        senderProfile: UserProfile? = null, quickReplies: List<QuickReply> = emptyList(),
    ) = messaging.sendMessage(
        conversation, senderName, body, messageType, orderTotalCents,
        attachmentNote, replyPreview, voiceDurationSec, senderProfile, quickReplies
    )

    suspend fun updateConversationWorkflow(
        conversationId: String, status: ConversationStatus, priority: PriorityLevel,
        labels: List<String>, actorName: String,
    ) = messaging.updateConversationWorkflow(conversationId, status, priority, labels, actorName)

    suspend fun toggleArchiveConversation(conversation: Conversation) = messaging.toggleArchiveConversation(conversation)
    suspend fun toggleMuteConversation(conversation: Conversation) = messaging.toggleMuteConversation(conversation)
    suspend fun setDisappearingHours(conversationId: String, hours: Long) = messaging.setDisappearingHours(conversationId, hours)
    suspend fun editMessage(conversationId: String, messageId: String, newBody: String) = messaging.editMessage(conversationId, messageId, newBody)
    suspend fun softDeleteMessage(conversationId: String, messageId: String) = messaging.softDeleteMessage(conversationId, messageId)
    suspend fun toggleMessagePin(conversationId: String, message: ChatMessage) = messaging.toggleMessagePin(conversationId, message)
    suspend fun toggleMessageStar(conversationId: String, message: ChatMessage) = messaging.toggleMessageStar(conversationId, message)
    suspend fun toggleMessageReaction(conversationId: String, message: ChatMessage, emoji: String) = messaging.toggleMessageReaction(conversationId, message, emoji)
    suspend fun markMessagesRead(conversationId: String, messages: List<ChatMessage>) = messaging.markMessagesRead(conversationId, messages)

    fun observeWorkspaceChannels(): Flow<List<BroadcastChannel>> = community.observeWorkspaceChannels()
    fun observeMyChannels(userId: String): Flow<List<BroadcastChannel>> = community.observeMyChannels(userId)
    fun observeChannelPosts(channelId: String, visibility: String): Flow<List<ChannelPost>> = community.observeChannelPosts(channelId, visibility)
    suspend fun createChannel(name: String, description: String, category: ChannelCategory, visibility: String, ownerName: String) =
        community.createChannel(name, description, category, visibility, ownerName)
    suspend fun toggleChannelMembership(channel: BroadcastChannel) = community.toggleChannelMembership(channel)
    suspend fun createChannelPost(channel: BroadcastChannel, authorName: String, title: String, body: String, pinned: Boolean) =
        community.createChannelPost(channel, authorName, title, body, pinned)
    suspend fun acknowledgeChannelPost(channelId: String, postId: String) = community.acknowledgeChannelPost(channelId, postId)

    fun observeContacts(userId: String): Flow<List<ContactEntry>> = community.observeContacts(userId)
    suspend fun addContact(displayName: String, handle: String, contactUid: String? = null, department: String? = null, note: String? = null) =
        community.addContact(displayName, handle, contactUid, department, note)
    suspend fun toggleBlockContact(contact: ContactEntry) = community.toggleBlockContact(contact)
    suspend fun deleteContact(contactId: String) = community.deleteContact(contactId)

    fun observeCalls(userId: String): Flow<List<CallSession>> = community.observeCalls(userId)
    suspend fun startCall(calleeId: String, calleeName: String, callType: CallType, callerName: String) =
        community.startCall(calleeId, calleeName, callType, callerName)
    suspend fun updateCallStatus(callId: String, status: CallStatus, durationSeconds: Long) =
        community.updateCallStatus(callId, status, durationSeconds)

    fun observeWorkspaceStatuses(): Flow<List<StatusUpdate>> = community.observeWorkspaceStatuses()
    fun observeMyStatuses(userId: String): Flow<List<StatusUpdate>> = community.observeMyStatuses(userId)
    suspend fun createStatus(authorName: String, text: String, mediaType: StatusMediaType, mediaNote: String?, visibility: String) =
        community.createStatus(authorName, text, mediaType, mediaNote, visibility)
    suspend fun reactToStatus(statusId: String) = community.reactToStatus(statusId)
    suspend fun deleteStatus(statusId: String) = community.deleteStatus(statusId)

    fun observePublicCatalog(): Flow<List<CatalogItem>> = business.observePublicCatalog()
    fun observeMyCatalog(userId: String): Flow<List<CatalogItem>> = business.observeMyCatalog(userId)
    suspend fun createCatalogItem(
        businessName: String, name: String, sku: String, description: String,
        priceCents: Long, currency: String, category: String, inStock: Boolean,
        visibility: String, actorName: String,
    ) = business.createCatalogItem(businessName, name, sku, description, priceCents, currency, category, inStock, visibility, actorName)
    suspend fun toggleCatalogStock(item: CatalogItem) = business.toggleCatalogStock(item)
    fun observeOrders(userId: String): Flow<List<BusinessOrder>> = business.observeOrders(userId)
    suspend fun placeOrder(item: CatalogItem, quantity: Long, customerName: String) = business.placeOrder(item, quantity, customerName)
    suspend fun updateOrderStatus(order: BusinessOrder, nextStatus: OrderStatus, actorName: String) =
        business.updateOrderStatus(order, nextStatus, actorName)
    fun observeQuickReplies(userId: String): Flow<List<QuickReply>> = business.observeQuickReplies(userId)
    suspend fun createQuickReply(shortcut: String, title: String, body: String, category: String) =
        business.createQuickReply(shortcut, title, body, category)
    suspend fun deleteQuickReply(replyId: String) = business.deleteQuickReply(replyId)
    fun observeCustomerNotes(userId: String): Flow<List<CustomerNote>> = business.observeCustomerNotes(userId)
    suspend fun addCustomerNote(customerName: String, label: String, note: String) = business.addCustomerNote(customerName, label, note)
    suspend fun deleteCustomerNote(noteId: String) = business.deleteCustomerNote(noteId)
    fun observeSubscription(userId: String): Flow<SubscriptionPlanRecord?> = business.observeSubscription(userId)
    fun observeInvoices(userId: String): Flow<List<InvoiceRecord>> = business.observeInvoices(userId)
    suspend fun changeSubscriptionPlan(tier: PlanTier, actorName: String) = business.changeSubscriptionPlan(tier, actorName)

    companion object {
        const val WORKSPACE_SCOPE = RepoScope.WORKSPACE_SCOPE
        const val BOOTSTRAP_ADMIN_EMAIL = RepoScope.BOOTSTRAP_ADMIN_EMAIL
    }
}
