package com.example.model

import androidx.annotation.Keep
import com.example.ui.i18n.ThemeMode
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

enum class UserRole(val label: String, val description: String) {
    ADMIN("Admin", "Full workspace governance, role assignment, and audit visibility"),
    BUSINESS_MANAGER("Business Manager", "Catalog management, order fulfillment, channels, and support escalation"),
    AGENT("Support Agent", "Ticket priority triage, customer support threads, and order updates"),
    MEMBER("Member", "Direct and group messaging, channel participation, and catalog ordering");

    companion object {
        fun fromRaw(raw: String?): UserRole =
            entries.firstOrNull { it.name == raw } ?: MEMBER
    }
}

enum class PresenceStatus(val label: String) {
    ONLINE("Online"),
    AWAY("Away"),
    BUSY("Busy");

    companion object {
        fun fromRaw(raw: String?): PresenceStatus =
            entries.firstOrNull { it.name == raw } ?: ONLINE
    }
}

enum class ConversationType(val label: String) {
    DIRECT("Direct"),
    GROUP("Team Group"),
    SUPPORT("Business Support");

    companion object {
        fun fromRaw(raw: String?): ConversationType =
            entries.firstOrNull { it.name == raw } ?: DIRECT
    }
}

enum class ConversationStatus(val label: String) {
    OPEN("Open"),
    PENDING("Pending"),
    RESOLVED("Resolved");

    companion object {
        fun fromRaw(raw: String?): ConversationStatus =
            entries.firstOrNull { it.name == raw } ?: OPEN
    }
}

enum class PriorityLevel(val label: String) {
    LOW("Low"),
    NORMAL("Normal"),
    HIGH("High"),
    URGENT("Urgent");

    companion object {
        fun fromRaw(raw: String?): PriorityLevel =
            entries.firstOrNull { it.name == raw } ?: NORMAL
    }
}

enum class MessageType {
    TEXT,
    ORDER_CARD,
    QUICK_REPLY,
    SYSTEM,
    VOICE,
    FILE;

    companion object {
        fun fromRaw(raw: String?): MessageType =
            entries.firstOrNull { it.name == raw } ?: TEXT
    }
}

enum class ChannelCategory(val label: String) {
    ANNOUNCEMENTS("Announcements"),
    ENGINEERING("Engineering"),
    SALES("Sales & Ops"),
    COMMUNITY("Community");

    companion object {
        fun fromRaw(raw: String?): ChannelCategory =
            entries.firstOrNull { it.name == raw } ?: ANNOUNCEMENTS
    }
}

enum class OrderStatus(val label: String) {
    PENDING("Pending"),
    CONFIRMED("Confirmed"),
    FULFILLED("Fulfilled"),
    CANCELLED("Cancelled");

    companion object {
        fun fromRaw(raw: String?): OrderStatus =
            entries.firstOrNull { it.name == raw } ?: PENDING
    }
}

enum class CallType(val label: String) {
    VOICE("Voice"),
    VIDEO("Video"),
    GROUP("Group");

    companion object {
        fun fromRaw(raw: String?): CallType =
            entries.firstOrNull { it.name == raw } ?: VOICE
    }
}

enum class CallStatus(val label: String) {
    RINGING("Ringing"),
    ACTIVE("Active"),
    ENDED("Ended"),
    MISSED("Missed"),
    DECLINED("Declined");

    companion object {
        fun fromRaw(raw: String?): CallStatus =
            entries.firstOrNull { it.name == raw } ?: ENDED
    }
}

enum class StatusMediaType(val label: String) {
    TEXT("Text"),
    IMAGE("Image"),
    VIDEO("Video");

    companion object {
        fun fromRaw(raw: String?): StatusMediaType =
            entries.firstOrNull { it.name == raw } ?: TEXT
    }
}

enum class TicketStatus(val label: String) {
    OPEN("Open"),
    IN_PROGRESS("In Progress"),
    RESOLVED("Resolved");

    companion object {
        fun fromRaw(raw: String?): TicketStatus =
            entries.firstOrNull { it.name == raw } ?: OPEN
    }
}

enum class PlanTier(
    val title: String,
    val monthlyPriceCents: Long,
    val tagline: String,
    val features: List<String>,
) {
    STARTER(
        title = "Starter",
        monthlyPriceCents = 0L,
        tagline = "Core messaging, channels & contacts",
        features = listOf("Up to 20 members per thread", "Workspace channels", "Deterministic SLA routing"),
    ),
    GROWTH(
        title = "Growth Pro",
        monthlyPriceCents = 2900L,
        tagline = "Business desk, CRM notes & quick replies",
        features = listOf("Verified business profile", "CRM labels & customer notes", "Catalog & order ledger"),
    ),
    ENTERPRISE(
        title = "Enterprise Desk",
        monthlyPriceCents = 9900L,
        tagline = "Full RBAC governance, audit trail & priority support",
        features = listOf("Role-based governance", "Immutable audit trail", "Priority escalation queue"),
    );

    companion object {
        fun fromRaw(raw: String?): PlanTier =
            entries.firstOrNull { it.name == raw } ?: STARTER
    }
}

@Keep
@IgnoreExtraProperties
data class UserProfile(
    @DocumentId val id: String = "",
    val userId: String = "",
    val displayName: String = "",
    val email: String = "",
    val role: String = UserRole.MEMBER.name,
    val department: String = "General",
    val presenceStatus: String = PresenceStatus.ONLINE.name,
    val businessName: String = "",
    val businessCategory: String = "",
    val verifiedBusiness: Boolean = false,
    val awayMessageEnabled: Boolean = false,
    val awayMessageText: String = "Thanks for reaching out. Our team is currently away and will reply during business hours.",
    val greetingText: String = "Welcome to ConnectX Business Desk. Type /hours or /pricing for instant info.",
    val languageCode: String = "en",
    val themeMode: String = ThemeMode.SYSTEM.name,
    val twoFactorEnabled: Boolean = false,
    val notificationsEnabled: Boolean = true,
    val lastSeenVisible: Boolean = true,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedRole: UserRole get() = UserRole.fromRaw(role)
    val parsedPresence: PresenceStatus get() = PresenceStatus.fromRaw(presenceStatus)
    val parsedThemeMode: ThemeMode get() = ThemeMode.fromRaw(themeMode)
}

@Keep
@IgnoreExtraProperties
data class DirectoryMember(
    @DocumentId val id: String = "",
    val userId: String = "",
    val displayName: String = "",
    val handle: String = "",
    val department: String = "General",
    val presenceStatus: String = PresenceStatus.ONLINE.name,
    val role: String = UserRole.MEMBER.name,
    val workspaceScope: String = "CONNECTX_WORKSPACE",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedRole: UserRole get() = UserRole.fromRaw(role)
    val parsedPresence: PresenceStatus get() = PresenceStatus.fromRaw(presenceStatus)
}

@Keep
@IgnoreExtraProperties
data class Conversation(
    @DocumentId val id: String = "",
    val title: String = "",
    val type: String = ConversationType.DIRECT.name,
    val ownerId: String = "",
    val memberUids: List<String> = emptyList(),
    val lastMessageText: String = "",
    val lastSenderId: String = "",
    @ServerTimestamp val lastMessageAt: Timestamp? = null,
    val status: String = ConversationStatus.OPEN.name,
    val priority: String = PriorityLevel.NORMAL.name,
    val labels: List<String> = emptyList(),
    val archivedByUids: List<String> = emptyList(),
    val mutedByUids: List<String> = emptyList(),
    val disappearingHours: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedType: ConversationType get() = ConversationType.fromRaw(type)
    val parsedStatus: ConversationStatus get() = ConversationStatus.fromRaw(status)
    val parsedPriority: PriorityLevel get() = PriorityLevel.fromRaw(priority)
}

@Keep
@IgnoreExtraProperties
data class ChatMessage(
    @DocumentId val id: String = "",
    val conversationId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val body: String = "",
    val messageType: String = MessageType.TEXT.name,
    val orderTotalCents: Long? = null,
    val attachmentNote: String? = null,
    val replyPreview: String? = null,
    val voiceDurationSec: Long? = null,
    val edited: Boolean = false,
    val deleted: Boolean = false,
    val pinned: Boolean = false,
    val starredByUids: List<String> = emptyList(),
    val reactions: List<String> = emptyList(),
    val readByUids: List<String> = emptyList(),
    val memberUids: List<String> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
) {
    val parsedType: MessageType get() = MessageType.fromRaw(messageType)
}

@Keep
@IgnoreExtraProperties
data class BroadcastChannel(
    @DocumentId val id: String = "",
    val name: String = "",
    val description: String = "",
    val category: String = ChannelCategory.ANNOUNCEMENTS.name,
    val ownerId: String = "",
    val ownerName: String = "",
    val memberUids: List<String> = emptyList(),
    val followerCount: Long = 1L,
    val visibility: String = "WORKSPACE",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedCategory: ChannelCategory get() = ChannelCategory.fromRaw(category)
}

@Keep
@IgnoreExtraProperties
data class ChannelPost(
    @DocumentId val id: String = "",
    val channelId: String = "",
    val authorId: String = "",
    val authorName: String = "",
    val title: String = "",
    val body: String = "",
    val pinned: Boolean = false,
    val visibility: String = "WORKSPACE",
    val memberUids: List<String> = emptyList(),
    val likesCount: Long = 0L,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class CatalogItem(
    @DocumentId val id: String = "",
    val ownerId: String = "",
    val businessName: String = "",
    val name: String = "",
    val sku: String = "",
    val description: String = "",
    val priceCents: Long = 0L,
    val currency: String = "USD",
    val category: String = "Services",
    val inStock: Boolean = true,
    val visibility: String = "PUBLIC_CATALOG",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class BusinessOrder(
    @DocumentId val id: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val merchantId: String = "",
    val itemId: String = "",
    val itemName: String = "",
    val quantity: Long = 1L,
    val unitPriceCents: Long = 0L,
    val totalCents: Long = 0L,
    val status: String = OrderStatus.PENDING.name,
    val memberUids: List<String> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedStatus: OrderStatus get() = OrderStatus.fromRaw(status)
}

@Keep
@IgnoreExtraProperties
data class QuickReply(
    @DocumentId val id: String = "",
    val userId: String = "",
    val shortcut: String = "",
    val title: String = "",
    val body: String = "",
    val category: String = "General",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class ContactEntry(
    @DocumentId val id: String = "",
    val userId: String = "",
    val contactUid: String? = null,
    val displayName: String = "",
    val handle: String = "",
    val department: String? = null,
    val note: String? = null,
    val blocked: Boolean = false,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class DeviceSession(
    @DocumentId val id: String = "",
    val userId: String = "",
    val deviceName: String = "",
    val platform: String = "",
    val trusted: Boolean = true,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class CustomerNote(
    @DocumentId val id: String = "",
    val userId: String = "",
    val customerName: String = "",
    val label: String = "",
    val note: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class SubscriptionPlanRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val planId: String = PlanTier.STARTER.name,
    val planName: String = PlanTier.STARTER.title,
    val monthlyPriceCents: Long = 0L,
    val status: String = "ACTIVE",
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedTier: PlanTier get() = PlanTier.fromRaw(planId)
}

@Keep
@IgnoreExtraProperties
data class InvoiceRecord(
    @DocumentId val id: String = "",
    val userId: String = "",
    val invoiceNumber: String = "",
    val planName: String = "",
    val amountCents: Long = 0L,
    val status: String = "PAID",
    @ServerTimestamp val createdAt: Timestamp? = null,
)

@Keep
@IgnoreExtraProperties
data class CallSession(
    @DocumentId val id: String = "",
    val callerId: String = "",
    val callerName: String = "",
    val calleeId: String = "",
    val calleeName: String = "",
    val callType: String = CallType.VOICE.name,
    val status: String = CallStatus.RINGING.name,
    val durationSeconds: Long = 0L,
    val memberUids: List<String> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedType: CallType get() = CallType.fromRaw(callType)
    val parsedStatus: CallStatus get() = CallStatus.fromRaw(status)
}

@Keep
@IgnoreExtraProperties
data class StatusUpdate(
    @DocumentId val id: String = "",
    val authorId: String = "",
    val authorName: String = "",
    val text: String = "",
    val mediaType: String = StatusMediaType.TEXT.name,
    val mediaNote: String? = null,
    val visibility: String = "WORKSPACE",
    val reactionsCount: Long = 0L,
    val memberUids: List<String> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedMediaType: StatusMediaType get() = StatusMediaType.fromRaw(mediaType)
}

@Keep
@IgnoreExtraProperties
data class SupportTicket(
    @DocumentId val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val subject: String = "",
    val category: String = "General",
    val description: String = "",
    val priority: String = PriorityLevel.NORMAL.name,
    val status: String = TicketStatus.OPEN.name,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null,
) {
    val parsedPriority: PriorityLevel get() = PriorityLevel.fromRaw(priority)
    val parsedStatus: TicketStatus get() = TicketStatus.fromRaw(status)
}

@Keep
@IgnoreExtraProperties
data class AuditLog(
    @DocumentId val id: String = "",
    val actorId: String = "",
    val actorName: String = "",
    val action: String = "",
    val targetType: String = "",
    val targetId: String = "",
    val summary: String = "",
    @ServerTimestamp val createdAt: Timestamp? = null,
)

data class BusinessMetrics(
    val totalCatalogCount: Int,
    val inStockCount: Int,
    val totalOrdersCount: Int,
    val fulfilledOrdersCount: Int,
    val revenueCents: Long,
    val openTicketsCount: Int,
)

/**
 * Pure deterministic, AI-free business logic rules engine for ConnectX.
 * Handles SLA triage, quick-reply command expansion, order totals, RBAC, and deterministic analytics.
 */
object DeterministicRulesEngine {

    fun classifySupportPriority(subject: String, message: String): PriorityLevel {
        val combined = "$subject $message".lowercase(Locale.ROOT)
        return when {
            listOf("outage", "down", "urgent", "critical", "breach", "blocked", "sev1")
                .any { combined.contains(it) } -> PriorityLevel.URGENT
            listOf("invoice", "payment", "refund", "escalate", "priority", "deadline")
                .any { combined.contains(it) } -> PriorityLevel.HIGH
            listOf("question", "feedback", "info", "demo", "hours")
                .any { combined.contains(it) } -> PriorityLevel.NORMAL
            else -> PriorityLevel.NORMAL
        }
    }

    fun calculateOrderTotalCents(quantity: Long, unitPriceCents: Long): Long {
        require(quantity in 1L..1000L) { "Quantity must be between 1 and 1000." }
        require(unitPriceCents in 0L..100_000_000L) { "Unit price out of valid range." }
        return quantity * unitPriceCents
    }

    fun resolveQuickReplyShortcut(input: String, templates: List<QuickReply>): String {
        val trimmed = input.trim()
        if (!trimmed.startsWith("/")) return input
        val matched = templates.firstOrNull {
            it.shortcut.equals(trimmed, ignoreCase = true)
        }
        return matched?.body ?: input
    }

    fun buildAutoReplyIfTriggered(
        messageBody: String,
        profile: UserProfile?,
        templates: List<QuickReply>,
    ): String? {
        if (profile == null) return null
        val trimmed = messageBody.trim()
        if (trimmed.startsWith("/")) {
            val match = templates.firstOrNull { it.shortcut.equals(trimmed, ignoreCase = true) }
            if (match != null) return "[Template ${match.shortcut}] ${match.body}"
        }
        if (profile.awayMessageEnabled && profile.awayMessageText.isNotBlank()) {
            return "[Auto-Away] ${profile.awayMessageText}"
        }
        return null
    }

    fun computeBusinessMetrics(
        catalog: List<CatalogItem>,
        orders: List<BusinessOrder>,
        tickets: List<SupportTicket>,
    ): BusinessMetrics {
        val activeOrders = orders.filter { it.parsedStatus != OrderStatus.CANCELLED }
        val fulfilled = orders.count { it.parsedStatus == OrderStatus.FULFILLED }
        val revenue = activeOrders.sumOf { it.totalCents }
        val openTickets = tickets.count { it.parsedStatus != TicketStatus.RESOLVED }
        return BusinessMetrics(
            totalCatalogCount = catalog.size,
            inStockCount = catalog.count { it.inStock },
            totalOrdersCount = orders.size,
            fulfilledOrdersCount = fulfilled,
            revenueCents = revenue,
            openTicketsCount = openTickets,
        )
    }

    fun formatDuration(seconds: Long): String {
        val safe = seconds.coerceAtLeast(0L)
        val mins = safe / 60L
        val secs = safe % 60L
        return String.format(Locale.US, "%02d:%02d", mins, secs)
    }

    fun canManageRoles(role: UserRole): Boolean = role == UserRole.ADMIN

    fun canManageTickets(role: UserRole): Boolean =
        role == UserRole.ADMIN || role == UserRole.BUSINESS_MANAGER || role == UserRole.AGENT

    fun canFulfillOrders(role: UserRole): Boolean =
        role == UserRole.ADMIN || role == UserRole.BUSINESS_MANAGER || role == UserRole.AGENT || role == UserRole.MEMBER

    fun formatMoney(cents: Long, currencyCode: String = "USD"): String {
        return try {
            val formatter = NumberFormat.getCurrencyInstance(Locale.US)
            formatter.currency = Currency.getInstance(currencyCode)
            formatter.format(cents / 100.0)
        } catch (_: Exception) {
            "$currencyCode ${String.format(Locale.US, "%.2f", cents / 100.0)}"
        }
    }
}
