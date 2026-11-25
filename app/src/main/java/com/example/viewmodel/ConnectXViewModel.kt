package com.example.viewmodel

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.ConnectXRepository
import com.example.data.UiState
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
import com.example.ui.i18n.ThemeMode
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class ConnectXViewModel(
    private val repository: ConnectXRepository,
    val currentUserId: String,
) : ViewModel() {

    private val _statusMessage = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val statusMessage = _statusMessage.asSharedFlow()

    private val _isActionBusy = MutableStateFlow(false)
    val isActionBusy: StateFlow<Boolean> = _isActionBusy.asStateFlow()

    init {
        viewModelScope.launch {
            val user = Firebase.auth.currentUser
            if (user != null && user.uid == currentUserId) {
                repository.ensureUserProvisioned(user).onFailure { err ->
                    _statusMessage.tryEmit(err.localizedMessage ?: "Profile sync pending")
                }
            }
        }
    }

    private fun <T> Flow<T>.toUiState(label: String): StateFlow<UiState<T>> =
        map<T, UiState<T>> { UiState.Success(it) }
            .catch { error ->
                val firestoreError = generateSequence(error) { it.cause }
                    .filterIsInstance<FirebaseFirestoreException>()
                    .firstOrNull()
                if (firestoreError == null && error is CancellationException) throw error
                val rootError = firestoreError ?: error
                Log.w(TAG, "Error observing $label", rootError)
                emit(UiState.Error(rootError.message ?: "Failed to load $label"))
            }
            .stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
                initialValue = UiState.Loading,
            )

    val userProfile: StateFlow<UiState<UserProfile?>> =
        repository.observeUserProfile(currentUserId).toUiState("profile")

    val directoryMembers: StateFlow<UiState<List<DirectoryMember>>> =
        repository.observeDirectoryMembers().toUiState("directory")

    val conversations: StateFlow<UiState<List<Conversation>>> =
        repository.observeConversations(currentUserId).toUiState("conversations")

    val workspaceChannels: StateFlow<UiState<List<BroadcastChannel>>> =
        repository.observeWorkspaceChannels().toUiState("workspace channels")

    val myChannels: StateFlow<UiState<List<BroadcastChannel>>> =
        repository.observeMyChannels(currentUserId).toUiState("my channels")

    val publicCatalog: StateFlow<UiState<List<CatalogItem>>> =
        repository.observePublicCatalog().toUiState("public catalog")

    val myCatalog: StateFlow<UiState<List<CatalogItem>>> =
        repository.observeMyCatalog(currentUserId).toUiState("my catalog")

    val orders: StateFlow<UiState<List<BusinessOrder>>> =
        repository.observeOrders(currentUserId).toUiState("orders")

    val quickReplies: StateFlow<UiState<List<QuickReply>>> =
        repository.observeQuickReplies(currentUserId).toUiState("quick replies")

    val contacts: StateFlow<UiState<List<ContactEntry>>> =
        repository.observeContacts(currentUserId).toUiState("contacts")

    val calls: StateFlow<UiState<List<CallSession>>> =
        repository.observeCalls(currentUserId).toUiState("calls")

    val workspaceStatuses: StateFlow<UiState<List<StatusUpdate>>> =
        repository.observeWorkspaceStatuses().toUiState("workspace statuses")

    val myStatuses: StateFlow<UiState<List<StatusUpdate>>> =
        repository.observeMyStatuses(currentUserId).toUiState("my statuses")

    val devices: StateFlow<UiState<List<DeviceSession>>> =
        repository.observeDevices(currentUserId).toUiState("devices")

    val customerNotes: StateFlow<UiState<List<CustomerNote>>> =
        repository.observeCustomerNotes(currentUserId).toUiState("customer notes")

    val subscription: StateFlow<UiState<SubscriptionPlanRecord?>> =
        repository.observeSubscription(currentUserId).toUiState("subscription")

    val invoices: StateFlow<UiState<List<InvoiceRecord>>> =
        repository.observeInvoices(currentUserId).toUiState("invoices")

    private val isAdminFlow = userProfile
        .map { (it as? UiState.Success)?.data?.parsedRole == UserRole.ADMIN }
        .distinctUntilChanged()

    val supportTickets: StateFlow<UiState<List<SupportTicket>>> =
        isAdminFlow
            .flatMapLatest { isAdmin -> repository.observeSupportTickets(currentUserId, isAdmin) }
            .toUiState("support tickets")

    val auditLogs: StateFlow<UiState<List<AuditLog>>> =
        isAdminFlow
            .flatMapLatest { isAdmin -> repository.observeAuditLogs(currentUserId, isAdmin) }
            .toUiState("audit logs")

    private val _selectedConversationId = MutableStateFlow<String?>(null)
    val selectedConversationId: StateFlow<String?> = _selectedConversationId.asStateFlow()

    val activeMessages: StateFlow<UiState<List<ChatMessage>>> =
        _selectedConversationId
            .flatMapLatest { convId ->
                if (convId.isNullOrBlank()) flowOf(emptyList())
                else repository.observeMessages(convId)
            }
            .toUiState("messages")

    private val _selectedChannelId = MutableStateFlow<String?>(null)
    private val _selectedChannelVisibility = MutableStateFlow("WORKSPACE")
    val selectedChannelId: StateFlow<String?> = _selectedChannelId.asStateFlow()

    val activeChannelPosts: StateFlow<UiState<List<ChannelPost>>> =
        _selectedChannelId
            .flatMapLatest { channelId ->
                if (channelId.isNullOrBlank()) flowOf(emptyList())
                else repository.observeChannelPosts(channelId, _selectedChannelVisibility.value)
            }
            .toUiState("channel posts")

    fun selectConversation(conversationId: String?) {
        _selectedConversationId.value = conversationId
    }

    fun selectChannel(channel: BroadcastChannel?) {
        _selectedChannelVisibility.value = channel?.visibility ?: "WORKSPACE"
        _selectedChannelId.value = channel?.id
    }

    private fun currentActorName(): String =
        (userProfile.value as? UiState.Success)?.data?.displayName?.ifBlank { "Member" } ?: "Member"

    private fun launchMutation(successToast: String? = null, block: suspend () -> Result<*>) {
        viewModelScope.launch {
            _isActionBusy.value = true
            val result = block()
            _isActionBusy.value = false
            result.onSuccess {
                if (successToast != null) _statusMessage.tryEmit(successToast)
            }.onFailure { err ->
                _statusMessage.tryEmit(err.localizedMessage ?: "Operation failed")
            }
        }
    }

    // --- MESSAGING MUTATIONS ---

    fun createConversation(
        title: String, type: ConversationType, participantUids: List<String>,
        initialMessage: String, labels: List<String>, onCreated: (String) -> Unit = {},
    ) {
        viewModelScope.launch {
            _isActionBusy.value = true
            val result = repository.createConversation(title, type, participantUids, initialMessage, currentActorName(), labels)
            _isActionBusy.value = false
            result.onSuccess { id ->
                _selectedConversationId.value = id
                _statusMessage.tryEmit("Conversation started")
                onCreated(id)
            }.onFailure { _statusMessage.tryEmit(it.localizedMessage ?: "Could not start conversation") }
        }
    }

    fun sendMessage(
        conversation: Conversation, body: String, messageType: MessageType = MessageType.TEXT,
        orderTotalCents: Long? = null, attachmentNote: String? = null,
        replyPreview: String? = null, voiceDurationSec: Long? = null,
    ) {
        val profile = (userProfile.value as? UiState.Success)?.data
        val templates = (quickReplies.value as? UiState.Success)?.data ?: emptyList()
        launchMutation {
            repository.sendMessage(
                conversation, currentActorName(), body, messageType,
                orderTotalCents, attachmentNote, replyPreview, voiceDurationSec, profile, templates,
            )
        }
    }

    fun markMessagesRead(conversationId: String, messages: List<ChatMessage>) {
        viewModelScope.launch { repository.markMessagesRead(conversationId, messages) }
    }

    fun updateConversationWorkflow(id: String, status: ConversationStatus, priority: PriorityLevel, labels: List<String>) =
        launchMutation("Thread workflow updated") { repository.updateConversationWorkflow(id, status, priority, labels, currentActorName()) }

    fun toggleArchiveConversation(conversation: Conversation) =
        launchMutation("Thread archive updated") { repository.toggleArchiveConversation(conversation) }

    fun toggleMuteConversation(conversation: Conversation) =
        launchMutation("Thread mute updated") { repository.toggleMuteConversation(conversation) }

    fun setDisappearingHours(conversationId: String, hours: Long) =
        launchMutation("Disappearing messages updated") { repository.setDisappearingHours(conversationId, hours) }

    fun editMessage(conversationId: String, messageId: String, newBody: String) =
        launchMutation("Message updated") { repository.editMessage(conversationId, messageId, newBody) }

    fun softDeleteMessage(conversationId: String, messageId: String) =
        launchMutation("Message removed") { repository.softDeleteMessage(conversationId, messageId) }

    fun toggleMessagePin(conversationId: String, message: ChatMessage) =
        launchMutation { repository.toggleMessagePin(conversationId, message) }

    fun toggleMessageStar(conversationId: String, message: ChatMessage) =
        launchMutation { repository.toggleMessageStar(conversationId, message) }

    fun toggleMessageReaction(conversationId: String, message: ChatMessage, emoji: String) =
        launchMutation { repository.toggleMessageReaction(conversationId, message, emoji) }

    // --- CHANNELS, CONTACTS, CALLS & STATUSES ---

    fun createChannel(name: String, description: String, category: ChannelCategory, visibility: String) =
        launchMutation("Channel published") { repository.createChannel(name, description, category, visibility, currentActorName()) }

    fun toggleChannelMembership(channel: BroadcastChannel) =
        launchMutation { repository.toggleChannelMembership(channel) }

    fun createChannelPost(channel: BroadcastChannel, title: String, body: String, pinned: Boolean) =
        launchMutation("Announcement posted") { repository.createChannelPost(channel, currentActorName(), title, body, pinned) }

    fun acknowledgePost(channelId: String, postId: String) =
        launchMutation { repository.acknowledgeChannelPost(channelId, postId) }

    fun addContact(displayName: String, handle: String, contactUid: String? = null, department: String? = null, note: String? = null) =
        launchMutation("Contact added") { repository.addContact(displayName, handle, contactUid, department, note) }

    fun toggleBlockContact(contact: ContactEntry) =
        launchMutation("Contact block updated") { repository.toggleBlockContact(contact) }

    fun deleteContact(contactId: String) =
        launchMutation("Contact removed") { repository.deleteContact(contactId) }

    fun startCall(calleeId: String, calleeName: String, callType: CallType, onStarted: (String) -> Unit = {}) {
        viewModelScope.launch {
            _isActionBusy.value = true
            val result = repository.startCall(calleeId, calleeName, callType, currentActorName())
            _isActionBusy.value = false
            result.onSuccess { onStarted(it) }
                .onFailure { _statusMessage.tryEmit(it.localizedMessage ?: "Failed to start call") }
        }
    }

    fun updateCallStatus(callId: String, status: CallStatus, durationSeconds: Long) =
        launchMutation { repository.updateCallStatus(callId, status, durationSeconds) }

    fun createStatus(text: String, mediaType: StatusMediaType, mediaNote: String?, visibility: String) =
        launchMutation("Status published") { repository.createStatus(currentActorName(), text, mediaType, mediaNote, visibility) }

    fun reactToStatus(statusId: String) =
        launchMutation { repository.reactToStatus(statusId) }

    fun deleteStatus(statusId: String) =
        launchMutation("Status deleted") { repository.deleteStatus(statusId) }

    // --- BUSINESS, CRM, BILLING, SETTINGS & SUPPORT ---

    fun createCatalogItem(
        businessName: String, name: String, sku: String, description: String,
        priceCents: Long, currency: String, category: String, inStock: Boolean, visibility: String,
    ) = launchMutation("Catalog item saved") {
        repository.createCatalogItem(businessName, name, sku, description, priceCents, currency, category, inStock, visibility, currentActorName())
    }

    fun toggleCatalogStock(item: CatalogItem) =
        launchMutation("Inventory updated") { repository.toggleCatalogStock(item) }

    fun placeOrder(item: CatalogItem, quantity: Long) =
        launchMutation("Order submitted") { repository.placeOrder(item, quantity, currentActorName()) }

    fun updateOrderStatus(order: BusinessOrder, nextStatus: OrderStatus) =
        launchMutation("Order marked ${nextStatus.label}") { repository.updateOrderStatus(order, nextStatus, currentActorName()) }

    fun createQuickReply(shortcut: String, title: String, body: String, category: String) =
        launchMutation("Quick reply saved") { repository.createQuickReply(shortcut, title, body, category) }

    fun deleteQuickReply(replyId: String) =
        launchMutation("Quick reply deleted") { repository.deleteQuickReply(replyId) }

    fun addCustomerNote(customerName: String, label: String, note: String) =
        launchMutation("CRM note saved") { repository.addCustomerNote(customerName, label, note) }

    fun deleteCustomerNote(noteId: String) =
        launchMutation("CRM note deleted") { repository.deleteCustomerNote(noteId) }

    fun changeSubscriptionPlan(tier: PlanTier) =
        launchMutation("Plan switched to ${tier.title}") { repository.changeSubscriptionPlan(tier, currentActorName()) }

    fun updateProfilePreferences(
        displayName: String, department: String, presenceStatus: PresenceStatus,
        businessName: String, businessCategory: String, awayMessageEnabled: Boolean,
        awayMessageText: String, greetingText: String,
    ) = launchMutation("Preferences saved") {
        repository.updateProfilePreferences(displayName, department, presenceStatus, businessName, businessCategory, awayMessageEnabled, awayMessageText, greetingText)
    }

    fun updateUserSettings(
        languageCode: String, themeMode: ThemeMode, twoFactorEnabled: Boolean,
        notificationsEnabled: Boolean, lastSeenVisible: Boolean, verifiedBusiness: Boolean,
    ) = launchMutation("Settings saved") {
        repository.updateUserSettings(languageCode, themeMode, twoFactorEnabled, notificationsEnabled, lastSeenVisible, verifiedBusiness)
    }

    fun revokeDevice(deviceId: String) =
        launchMutation("Device session revoked") { repository.revokeDevice(deviceId) }

    fun deleteOwnAccountData(onComplete: () -> Unit) {
        viewModelScope.launch {
            _isActionBusy.value = true
            val res = repository.deleteOwnAccountData(currentActorName())
            _isActionBusy.value = false
            res.onSuccess {
                _statusMessage.tryEmit("Personal data purged")
                onComplete()
            }.onFailure {
                _statusMessage.tryEmit(it.localizedMessage ?: "Failed to purge data")
            }
        }
    }

    fun createSupportTicket(subject: String, category: String, description: String) =
        launchMutation("Support ticket submitted") { repository.createSupportTicket(currentActorName(), subject, category, description) }

    fun updateSupportTicketStatus(ticket: SupportTicket, nextStatus: TicketStatus) =
        launchMutation("Ticket updated") { repository.updateSupportTicketStatus(ticket, nextStatus) }

    fun updateMemberRoleByAdmin(targetUserId: String, newRole: UserRole, department: String) =
        launchMutation("Role updated to ${newRole.label}") { repository.updateMemberRoleByAdmin(targetUserId, newRole, department, currentActorName()) }

    private companion object {
        const val TAG = "ConnectXVM"
        const val STOP_TIMEOUT_MILLIS = 5000L
    }
}
