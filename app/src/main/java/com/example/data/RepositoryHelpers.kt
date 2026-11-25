package com.example.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.tasks.await

internal class RepoScope(
    val db: FirebaseFirestore,
    val auth: FirebaseAuth,
) {
    fun requireUserId(): String {
        return auth.currentUser?.uid?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("User must be signed in with Google before accessing Firestore.")
    }

    fun <T> Flow<T>.handleFirestoreStreamError(
        operationType: OperationType,
        path: String,
        expectedUid: String,
    ): Flow<T> = catch { error ->
        val firestoreError = generateSequence(error) { it.cause }
            .filterIsInstance<FirebaseFirestoreException>()
            .firstOrNull()
        if (firestoreError == null && error is CancellationException) throw error
        val exceptionToLog = firestoreError ?: (error as? Exception)
        if (exceptionToLog != null && auth.currentUser?.uid == expectedUid) {
            handleFirestoreError(exceptionToLog, operationType, path)
        }
        throw error
    }

    suspend fun recordAuditLog(
        actorId: String,
        actorName: String,
        action: String,
        targetType: String,
        targetId: String,
        summary: String,
    ) {
        val logRef = db.collection("audit_logs").document()
        logRef.set(
            mapOf(
                "actorId" to actorId,
                "actorName" to actorName.ifBlank { "Member" }.take(80),
                "action" to action.take(60),
                "targetType" to targetType.take(40),
                "targetId" to targetId.take(128),
                "summary" to summary.take(300),
                "createdAt" to FieldValue.serverTimestamp(),
            )
        ).await()
    }

    companion object {
        const val WORKSPACE_SCOPE = "CONNECTX_WORKSPACE"
        const val BOOTSTRAP_ADMIN_EMAIL = "sh7052968@gmail.com"
    }
}
