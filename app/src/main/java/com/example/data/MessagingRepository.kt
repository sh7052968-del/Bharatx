package com.example.data

import com.example.model.ChatMessage
import com.example.model.Conversation
import com.example.model.ConversationStatus
import com.example.model.ConversationType
import com.example.model.DeterministicRulesEngine
import com.example.model.MessageType
import com.example.model.PriorityLevel
import com.example.model.QuickReply
import com.example.model.UserProfile
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

internal class MessagingRepository(private val scope: RepoScope) {

    fun observeConversations(userId: String): Flow<List<Conversation>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Conversations stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("conversations")
                    .whereArrayContains("memberUids", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(Conversation::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.lastMessageAt ?: it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "conversations", uid)
            )
        }
    }

    fun observeMessages(conversationId: String): Flow<List<ChatMessage>> = flow {
        val uid = scope.requireUserId()
        require(conversationId.isNotBlank()) { "Conversation ID required." }
        val path = "conversations/$conversationId/messages"
        with(scope) {
            emitAll(
                db.collection("conversations").document(conversationId).collection("messages")
                    .whereArrayContains("memberUids", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(ChatMessage::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedBy { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun createConversation(
        title: String,
        type: ConversationType,
        participantUids: List<String>,
        initialMessage: String,
        senderName: String,
        labels: List<String> = emptyList(),
    ): Result<String> {
        var docPath = "conversations"
        return try {
            val uid = scope.requireUserId()
            val cleanTitle = title.trim().take(100)
            val cleanBody = initialMessage.trim().take(2000)
            require(cleanTitle.isNotEmpty()) { "Conversation title is required." }
            require(cleanBody.isNotEmpty()) { "Initial message is required." }

            val members = (listOf(uid) + participantUids).distinct().take(20)
            val priority = if (type == ConversationType.SUPPORT) {
                DeterministicRulesEngine.classifySupportPriority(cleanTitle, cleanBody)
            } else {
                PriorityLevel.NORMAL
            }
            val cleanLabels = labels.map { it.trim().take(24) }.filter { it.isNotEmpty() }.take(5)

            val convRef = scope.db.collection("conversations").document()
            docPath = convRef.path
            convRef.set(
                mapOf(
                    "title" to cleanTitle,
                    "type" to type.name,
                    "ownerId" to uid,
                    "memberUids" to members,
                    "lastMessageText" to cleanBody.take(300),
                    "lastSenderId" to uid,
                    "lastMessageAt" to FieldValue.serverTimestamp(),
                    "status" to ConversationStatus.OPEN.name,
                    "priority" to priority.name,
                    "labels" to cleanLabels,
                    "archivedByUids" to emptyList<String>(),
                    "mutedByUids" to emptyList<String>(),
                    "disappearingHours" to 0L,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            convRef.collection("messages").document().set(
                mapOf(
                    "conversationId" to convRef.id,
                    "senderId" to uid,
                    "senderName" to senderName.ifBlank { "Member" }.take(80),
                    "body" to cleanBody,
                    "messageType" to MessageType.TEXT.name,
                    "readByUids" to listOf(uid),
                    "memberUids" to members,
                    "createdAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = senderName,
                action = "CONVERSATION_CREATED",
                targetType = "CONVERSATION",
                targetId = convRef.id,
                summary = "Created ${type.label} thread '$cleanTitle' (${priority.label} priority)",
            )

            Result.success(convRef.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun sendMessage(
        conversation: Conversation,
        senderName: String,
        body: String,
        messageType: MessageType = MessageType.TEXT,
        orderTotalCents: Long? = null,
        attachmentNote: String? = null,
        replyPreview: String? = null,
        voiceDurationSec: Long? = null,
        senderProfile: UserProfile? = null,
        quickReplies: List<QuickReply> = emptyList(),
    ): Result<Unit> {
        var docPath = "conversations/${conversation.id}/messages"
        return try {
            val uid = scope.requireUserId()
            require(conversation.id.isNotBlank()) { "Conversation ID missing." }
            require(conversation.parsedStatus != ConversationStatus.RESOLVED) {
                "Resolved threads are locked. Reopen before posting."
            }
            val expanded = DeterministicRulesEngine.resolveQuickReplyShortcut(body, quickReplies)
                .trim()
                .take(2000)
            require(expanded.isNotEmpty()) { "Message cannot be empty." }

            val convRef = scope.db.collection("conversations").document(conversation.id)
            val msgRef = convRef.collection("messages").document()
            docPath = msgRef.path
            val members = (conversation.memberUids + uid).distinct().take(20)
            val payload = mapOf(
                "conversationId" to conversation.id,
                "senderId" to uid,
                "senderName" to senderName.ifBlank { "Member" }.take(80),
                "body" to expanded,
                "messageType" to messageType.name,
                "orderTotalCents" to orderTotalCents?.coerceAtLeast(0L),
                "attachmentNote" to attachmentNote?.trim()?.take(120)?.takeIf { it.isNotEmpty() },
                "replyPreview" to replyPreview?.trim()?.take(160)?.takeIf { it.isNotEmpty() },
                "voiceDurationSec" to voiceDurationSec?.coerceIn(0L, 600L),
                "readByUids" to listOf(uid),
                "memberUids" to members,
                "createdAt" to FieldValue.serverTimestamp(),
            ).filterValues { it != null }

            msgRef.set(payload).await()
            convRef.update(
                mapOf(
                    "lastMessageText" to expanded.take(300),
                    "lastSenderId" to uid,
                    "lastMessageAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            if (conversation.parsedType == ConversationType.SUPPORT && messageType == MessageType.TEXT) {
                val autoReply = DeterministicRulesEngine.buildAutoReplyIfTriggered(
                    messageBody = body,
                    profile = senderProfile,
                    templates = quickReplies,
                )
                if (autoReply != null && body.trim() != expanded && senderProfile?.awayMessageEnabled == true) {
                    convRef.collection("messages").document().set(
                        mapOf(
                            "conversationId" to conversation.id,
                            "senderId" to uid,
                            "senderName" to "ConnectX Rules Engine",
                            "body" to autoReply.take(2000),
                            "messageType" to MessageType.SYSTEM.name,
                            "memberUids" to members,
                            "createdAt" to FieldValue.serverTimestamp(),
                        )
                    ).await()
                }
            }

            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateConversationWorkflow(
        conversationId: String,
        status: ConversationStatus,
        priority: PriorityLevel,
        labels: List<String>,
        actorName: String,
    ): Result<Unit> {
        val docPath = "conversations/$conversationId"
        return try {
            val uid = scope.requireUserId()
            require(conversationId.isNotBlank()) { "Conversation ID required." }
            val cleanLabels = labels.map { it.trim().take(24) }.filter { it.isNotEmpty() }.take(5)
            scope.db.collection("conversations").document(conversationId).update(
                mapOf(
                    "status" to status.name,
                    "priority" to priority.name,
                    "labels" to cleanLabels,
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = actorName,
                action = "CONVERSATION_UPDATED",
                targetType = "CONVERSATION",
                targetId = conversationId,
                summary = "Set status=${status.name}, priority=${priority.name}",
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleArchiveConversation(conversation: Conversation): Result<Unit> {
        val docPath = "conversations/${conversation.id}"
        return try {
            val uid = scope.requireUserId()
            val updated = if (uid in conversation.archivedByUids) {
                conversation.archivedByUids.filterNot { it == uid }
            } else {
                (conversation.archivedByUids + uid).distinct().take(20)
            }
            scope.db.collection("conversations").document(conversation.id).update(
                mapOf("archivedByUids" to updated, "updatedAt" to FieldValue.serverTimestamp())
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleMuteConversation(conversation: Conversation): Result<Unit> {
        val docPath = "conversations/${conversation.id}"
        return try {
            val uid = scope.requireUserId()
            val updated = if (uid in conversation.mutedByUids) {
                conversation.mutedByUids.filterNot { it == uid }
            } else {
                (conversation.mutedByUids + uid).distinct().take(20)
            }
            scope.db.collection("conversations").document(conversation.id).update(
                mapOf("mutedByUids" to updated, "updatedAt" to FieldValue.serverTimestamp())
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun setDisappearingHours(conversationId: String, hours: Long): Result<Unit> {
        val docPath = "conversations/$conversationId"
        return try {
            scope.requireUserId()
            require(hours in listOf(0L, 24L, 168L, 720L)) { "Invalid disappearing interval." }
            scope.db.collection("conversations").document(conversationId).update(
                mapOf("disappearingHours" to hours, "updatedAt" to FieldValue.serverTimestamp())
            ).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun editMessage(conversationId: String, messageId: String, newBody: String): Result<Unit> {
        val docPath = "conversations/$conversationId/messages/$messageId"
        return try {
            scope.requireUserId()
            val clean = newBody.trim().take(2000)
            require(clean.isNotEmpty()) { "Edited message cannot be empty." }
            scope.db.collection("conversations").document(conversationId)
                .collection("messages").document(messageId)
                .update(mapOf("body" to clean, "edited" to true))
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun softDeleteMessage(conversationId: String, messageId: String): Result<Unit> {
        val docPath = "conversations/$conversationId/messages/$messageId"
        return try {
            scope.requireUserId()
            scope.db.collection("conversations").document(conversationId)
                .collection("messages").document(messageId)
                .update(mapOf("body" to "[Message deleted]", "deleted" to true))
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleMessagePin(conversationId: String, message: ChatMessage): Result<Unit> {
        val docPath = "conversations/$conversationId/messages/${message.id}"
        return try {
            scope.requireUserId()
            scope.db.collection("conversations").document(conversationId)
                .collection("messages").document(message.id)
                .update(mapOf("pinned" to !message.pinned))
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleMessageStar(conversationId: String, message: ChatMessage): Result<Unit> {
        val docPath = "conversations/$conversationId/messages/${message.id}"
        return try {
            val uid = scope.requireUserId()
            val updated = if (uid in message.starredByUids) {
                message.starredByUids.filterNot { it == uid }
            } else {
                (message.starredByUids + uid).distinct().take(20)
            }
            scope.db.collection("conversations").document(conversationId)
                .collection("messages").document(message.id)
                .update(mapOf("starredByUids" to updated))
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleMessageReaction(conversationId: String, message: ChatMessage, emoji: String): Result<Unit> {
        val docPath = "conversations/$conversationId/messages/${message.id}"
        return try {
            val uid = scope.requireUserId()
            val token = "$emoji:$uid"
            val updated = if (token in message.reactions) {
                message.reactions.filterNot { it == token }
            } else {
                (message.reactions + token).distinct().take(10)
            }
            scope.db.collection("conversations").document(conversationId)
                .collection("messages").document(message.id)
                .update(mapOf("reactions" to updated))
                .await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun markMessagesRead(conversationId: String, messages: List<ChatMessage>) {
        try {
            val uid = scope.requireUserId()
            val unread = messages.filter { uid !in it.readByUids && it.senderId != uid }
            for (msg in unread.take(15)) {
                val updated = (msg.readByUids + uid).distinct().take(20)
                scope.db.collection("conversations").document(conversationId)
                    .collection("messages").document(msg.id)
                    .update(mapOf("readByUids" to updated))
                    .await()
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Non-fatal read receipt update
        }
    }
}
