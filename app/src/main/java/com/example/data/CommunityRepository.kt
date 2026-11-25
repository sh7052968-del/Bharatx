package com.example.data

import com.example.model.BroadcastChannel
import com.example.model.CallSession
import com.example.model.CallStatus
import com.example.model.CallType
import com.example.model.ChannelCategory
import com.example.model.ChannelPost
import com.example.model.ContactEntry
import com.example.model.StatusMediaType
import com.example.model.StatusUpdate
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

internal class CommunityRepository(private val scope: RepoScope) {

    // --- CHANNELS & COMMUNITIES ---

    fun observeWorkspaceChannels(): Flow<List<BroadcastChannel>> = flow {
        val uid = scope.requireUserId()
        with(scope) {
            emitAll(
                db.collection("channels")
                    .whereEqualTo("visibility", "WORKSPACE")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(BroadcastChannel::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.followerCount }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "channels", uid)
            )
        }
    }

    fun observeMyChannels(userId: String): Flow<List<BroadcastChannel>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Channel stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("channels")
                    .whereArrayContains("memberUids", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(BroadcastChannel::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.updatedAt ?: it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "channels", uid)
            )
        }
    }

    fun observeChannelPosts(channelId: String, visibility: String): Flow<List<ChannelPost>> = flow {
        val uid = scope.requireUserId()
        require(channelId.isNotBlank()) { "Channel ID required." }
        val path = "channels/$channelId/posts"
        val base = scope.db.collection("channels").document(channelId).collection("posts")
        val query = if (visibility == "WORKSPACE") {
            base.whereEqualTo("visibility", "WORKSPACE")
        } else {
            base.whereArrayContains("memberUids", uid)
        }
        with(scope) {
            emitAll(
                query.snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(ChannelPost::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedWith(
                                compareByDescending<ChannelPost> { it.pinned }
                                    .thenByDescending { it.createdAt ?: Timestamp(0, 0) }
                            )
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun createChannel(
        name: String,
        description: String,
        category: ChannelCategory,
        visibility: String,
        ownerName: String,
    ): Result<String> {
        var docPath = "channels"
        return try {
            val uid = scope.requireUserId()
            val cleanName = name.trim().take(80)
            val cleanDesc = description.trim().take(400)
            require(cleanName.length >= 2) { "Channel name must be at least 2 characters." }
            val safeVis = if (visibility == "PRIVATE") "PRIVATE" else "WORKSPACE"

            val ref = scope.db.collection("channels").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "name" to cleanName,
                    "description" to cleanDesc,
                    "category" to category.name,
                    "ownerId" to uid,
                    "ownerName" to ownerName.ifBlank { "Member" }.take(80),
                    "memberUids" to listOf(uid),
                    "followerCount" to 1L,
                    "visibility" to safeVis,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()

            scope.recordAuditLog(
                actorId = uid,
                actorName = ownerName,
                action = "CHANNEL_CREATED",
                targetType = "CHANNEL",
                targetId = ref.id,
                summary = "Created $safeVis channel '$cleanName'",
            )
            Result.success(ref.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleChannelMembership(channel: BroadcastChannel): Result<Unit> {
        val docPath = "channels/${channel.id}"
        return try {
            val uid = scope.requireUserId()
            require(channel.id.isNotBlank()) { "Channel ID required." }
            val isMember = uid in channel.memberUids
            val updatedMembers = if (isMember) {
                if (channel.ownerId == uid) return Result.failure(IllegalStateException("Channel owner cannot leave channel."))
                channel.memberUids.filterNot { it == uid }
            } else {
                (channel.memberUids + uid).distinct().take(50)
            }
            scope.db.collection("channels").document(channel.id).update(
                mapOf(
                    "memberUids" to updatedMembers,
                    "followerCount" to updatedMembers.size.toLong(),
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

    suspend fun createChannelPost(
        channel: BroadcastChannel,
        authorName: String,
        title: String,
        body: String,
        pinned: Boolean,
    ): Result<Unit> {
        var docPath = "channels/${channel.id}/posts"
        return try {
            val uid = scope.requireUserId()
            val cleanTitle = title.trim().take(120)
            val cleanBody = body.trim().take(3000)
            require(cleanTitle.isNotEmpty() && cleanBody.isNotEmpty()) { "Title and body are required." }

            val postRef = scope.db.collection("channels").document(channel.id).collection("posts").document()
            docPath = postRef.path
            postRef.set(
                mapOf(
                    "channelId" to channel.id,
                    "authorId" to uid,
                    "authorName" to authorName.ifBlank { "Member" }.take(80),
                    "title" to cleanTitle,
                    "body" to cleanBody,
                    "pinned" to pinned,
                    "visibility" to channel.visibility,
                    "memberUids" to channel.memberUids.ifEmpty { listOf(uid) }.take(50),
                    "likesCount" to 0L,
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

    suspend fun acknowledgeChannelPost(channelId: String, postId: String): Result<Unit> {
        val docPath = "channels/$channelId/posts/$postId"
        return try {
            scope.requireUserId()
            scope.db.collection("channels").document(channelId)
                .collection("posts").document(postId)
                .update(
                    mapOf(
                        "likesCount" to FieldValue.increment(1L),
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

    // --- CONTACTS ---

    fun observeContacts(userId: String): Flow<List<ContactEntry>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Contacts stream must be scoped to signed-in user." }
        val path = "users/$uid/contacts"
        with(scope) {
            emitAll(
                db.collection("users").document(uid).collection("contacts")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(ContactEntry::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedBy { it.displayName.lowercase(Locale.ROOT) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, path, uid)
            )
        }
    }

    suspend fun addContact(
        displayName: String,
        handle: String,
        contactUid: String? = null,
        department: String? = null,
        note: String? = null,
    ): Result<Unit> {
        var docPath = "users/unknown/contacts"
        return try {
            val uid = scope.requireUserId()
            val cleanName = displayName.trim().take(80)
            val cleanHandle = handle.trim().removePrefix("@").take(60)
            require(cleanName.isNotEmpty() && cleanHandle.isNotEmpty()) { "Name and handle are required." }

            val ref = scope.db.collection("users").document(uid).collection("contacts").document()
            docPath = ref.path
            val payload = mapOf(
                "userId" to uid,
                "contactUid" to contactUid?.trim()?.take(128)?.takeIf { it.isNotEmpty() },
                "displayName" to cleanName,
                "handle" to cleanHandle,
                "department" to department?.trim()?.take(60)?.takeIf { it.isNotEmpty() },
                "note" to note?.trim()?.take(200)?.takeIf { it.isNotEmpty() },
                "blocked" to false,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            ).filterValues { it != null }
            ref.set(payload).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun toggleBlockContact(contact: ContactEntry): Result<Unit> {
        var docPath = "users/unknown/contacts/${contact.id}"
        return try {
            val uid = scope.requireUserId()
            val ref = scope.db.collection("users").document(uid).collection("contacts").document(contact.id)
            docPath = ref.path
            ref.update(
                mapOf(
                    "blocked" to !contact.blocked,
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

    suspend fun deleteContact(contactId: String): Result<Unit> {
        var docPath = "users/unknown/contacts/$contactId"
        return try {
            val uid = scope.requireUserId()
            val ref = scope.db.collection("users").document(uid).collection("contacts").document(contactId)
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

    // --- CALLING ---

    fun observeCalls(userId: String): Flow<List<CallSession>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Calls stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("calls")
                    .whereArrayContains("memberUids", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(CallSession::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "calls", uid)
            )
        }
    }

    suspend fun startCall(
        calleeId: String,
        calleeName: String,
        callType: CallType,
        callerName: String,
    ): Result<String> {
        var docPath = "calls"
        return try {
            val uid = scope.requireUserId()
            val cleanCalleeId = calleeId.trim().take(128)
            val cleanCalleeName = calleeName.trim().take(80)
            require(cleanCalleeId.isNotEmpty() && cleanCalleeName.isNotEmpty()) { "Recipient required for call." }
            val members = listOf(uid, cleanCalleeId).distinct().take(10)

            val ref = scope.db.collection("calls").document()
            docPath = ref.path
            ref.set(
                mapOf(
                    "callerId" to uid,
                    "callerName" to callerName.ifBlank { "Member" }.take(80),
                    "calleeId" to cleanCalleeId,
                    "calleeName" to cleanCalleeName,
                    "callType" to callType.name,
                    "status" to CallStatus.RINGING.name,
                    "durationSeconds" to 0L,
                    "memberUids" to members,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp(),
                )
            ).await()
            Result.success(ref.id)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun updateCallStatus(callId: String, status: CallStatus, durationSeconds: Long): Result<Unit> {
        val docPath = "calls/$callId"
        return try {
            scope.requireUserId()
            scope.db.collection("calls").document(callId).update(
                mapOf(
                    "status" to status.name,
                    "durationSeconds" to durationSeconds.coerceIn(0L, 86400L),
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

    // --- STATUSES ---

    fun observeWorkspaceStatuses(): Flow<List<StatusUpdate>> = flow {
        val uid = scope.requireUserId()
        with(scope) {
            emitAll(
                db.collection("statuses")
                    .whereEqualTo("visibility", "WORKSPACE")
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(StatusUpdate::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "statuses", uid)
            )
        }
    }

    fun observeMyStatuses(userId: String): Flow<List<StatusUpdate>> = flow {
        val uid = scope.requireUserId()
        require(uid == userId) { "Status stream must be scoped to signed-in user." }
        with(scope) {
            emitAll(
                db.collection("statuses")
                    .whereArrayContains("memberUids", uid)
                    .snapshots()
                    .map { snapshot ->
                        snapshot.toObjects(StatusUpdate::class.java, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)
                            .sortedByDescending { it.createdAt ?: Timestamp(0, 0) }
                    }
                    .handleFirestoreStreamError(OperationType.LIST, "statuses", uid)
            )
        }
    }

    suspend fun createStatus(
        authorName: String,
        text: String,
        mediaType: StatusMediaType,
        mediaNote: String?,
        visibility: String,
    ): Result<Unit> {
        var docPath = "statuses"
        return try {
            val uid = scope.requireUserId()
            val cleanText = text.trim().take(500)
            require(cleanText.isNotEmpty()) { "Status update text is required." }
            val safeVis = if (visibility == "PRIVATE") "PRIVATE" else "WORKSPACE"

            val ref = scope.db.collection("statuses").document()
            docPath = ref.path
            val payload = mapOf(
                "authorId" to uid,
                "authorName" to authorName.ifBlank { "Member" }.take(80),
                "text" to cleanText,
                "mediaType" to mediaType.name,
                "mediaNote" to mediaNote?.trim()?.take(120)?.takeIf { it.isNotEmpty() },
                "visibility" to safeVis,
                "reactionsCount" to 0L,
                "memberUids" to listOf(uid),
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp(),
            ).filterValues { it != null }
            ref.set(payload).await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, docPath)
            Result.failure(e)
        }
    }

    suspend fun reactToStatus(statusId: String): Result<Unit> {
        val docPath = "statuses/$statusId"
        return try {
            scope.requireUserId()
            scope.db.collection("statuses").document(statusId).update(
                mapOf(
                    "reactionsCount" to FieldValue.increment(1L),
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

    suspend fun deleteStatus(statusId: String): Result<Unit> {
        val docPath = "statuses/$statusId"
        return try {
            scope.requireUserId()
            scope.db.collection("statuses").document(statusId).delete().await()
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, docPath)
            Result.failure(e)
        }
    }
}
