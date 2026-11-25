# ConnectX Architecture & Firestore Data Contract

## Overview
ConnectX is an AI-free, deterministic enterprise messaging, social communication, and business operations Android application built with Kotlin, Jetpack Compose (Material 3), Firebase Authentication (Google Sign-In via Credential Manager), and Cloud Firestore (Enterprise named database).

## Modular Application Layers
- **Models & Rules (`com.example.model.ConnectXModels`)**: Immutable Firestore data classes and `DeterministicRulesEngine` (SLA keyword triage, exact order arithmetic, `/shortcut` quick replies, business metrics aggregation, RBAC checks, and call timer formatting).
- **Repositories (`com.example.data`)**:
  - `MessagingRepository`: Conversations, real-time messages, edit/soft-delete/pin/star/reactions, read receipts, archive/mute/disappearing configuration.
  - `CommunityRepository`: Broadcast channels/posts, personal contacts, call sessions, and status updates.
  - `BusinessRepository`: Catalog items, arithmetic-verified orders, quick replies, CRM customer notes, subscription plans, and invoices.
  - `ConnectXRepository`: Unified facade adding user provisioning, device session tracking, support tickets, admin RBAC updates, audit logs, and personal data purge.
- **ViewModel (`com.example.viewmodel.ConnectXViewModel`)**: Lifecycle-aware `StateFlow<UiState<T>>` streams and optimistic error/toast feedback.
- **UI & Localization (`com.example.ui`)**: Responsive 5-tab navigation (`Home`, `Chats`, `Hub`, `Business`, `More`) supporting `NavigationBar` and `NavigationRail`, live `SYSTEM`/`LIGHT`/`DARK` theming (`Theme.kt`), and `LocalConnectXStrings` supporting English (`en`), Hindi (`hi`), and Assamese (`as`).

## Collections & Zero-Trust Rules
- `/users/{userId}` — Private owner/admin user profiles (settings, business profile, away/greeting rules; protected against cross-user reads and role self-escalation).
- `/users/{userId}/quick_replies/{replyId}` — Owner-scoped deterministic `/shortcut` reply templates.
- `/users/{userId}/contacts/{contactId}` — Owner-scoped contact list with block status and notes.
- `/users/{userId}/devices/{deviceId}` — Owner-scoped active device sessions.
- `/users/{userId}/customer_notes/{noteId}` — Owner-scoped CRM customer labels and notes.
- `/users/{userId}/subscription/current` & `/users/{userId}/invoices/{invoiceId}` — Owner-scoped billing tier and invoice history.
- `/admins/{userId}` — Trusted admin grant registry verified via `isAdmin()`.
- `/directory_profiles/{userId}` — PII-free workspace member directory scoped by `workspaceScope == "CONNECTX_WORKSPACE"`.
- `/conversations/{conversationId}` & `/conversations/{conversationId}/messages/{messageId}` — Member-scoped real-time messaging with denormalized `memberUids`, archive/mute/disappearing metadata, message edit/delete/pin/star/reactions, read receipts, and terminal `RESOLVED` locking.
- `/channels/{channelId}` & `/channels/{channelId}/posts/{postId}` — Workspace & private broadcast channels with owner/admin publishing and pinned announcements.
- `/calls/{callId}` — Participant-scoped voice, video, and group call signaling & history.
- `/statuses/{statusId}` — Workspace and private status updates (`TEXT`, `IMAGE`, `VIDEO`).
- `/catalog_items/{itemId}` — Public and draft business catalog SKUs.
- `/orders/{orderId}` — Deterministic orders enforcing `totalCents == quantity * unitPriceCents` and terminal state locking on `FULFILLED`/`CANCELLED`.
- `/support_tickets/{ticketId}` — Owner/admin support ticket queue with deterministic priority classification.
- `/audit_logs/{logId}` — Immutable compliance and governance audit log entries.

## Enterprise Node.js / NestJS Backend & PostgreSQL Database (`/backend`)
- **Stack**: Node.js 22, NestJS 11, TypeScript, Prisma ORM + PostgreSQL 16 (`backend/prisma/schema.prisma`), Redis 7, RabbitMQ 3, Socket.IO (`/realtime`), Coturn TURN/STUN, NGINX reverse proxy, and Docker Compose (`backend/docker-compose.yml`).
- **PostgreSQL Enterprise Data Model (Domains A–K)**: Covers User, Chat, Group, Community, Business, Calling, Notification, Admin RBAC, Feature Control, Billing, and System Operations tables with UTC `TIMESTAMPTZ(3)` columns, E2EE (`messages_e2ee_no_plaintext_chk`) & deterministic arithmetic (`business_orders_arithmetic_chk`) constraints, partial cursor indexes, GIN tag indexing, monthly range partitioning (`messages_archive_partitioned`, `system_logs_partitioned`), and `purge_expired_connectx_records()`.
- **Security & E2EE Boundary**: Argon2id password hashing, rotating refresh tokens with family revocation on reuse, RFC-6238 TOTP MFA encrypted via AES-256-GCM, Helmet + strict CORS + rate limiting (`ThrottlerGuard`), `Idempotency-Key` protection, and strict admin isolation preventing administrators from querying or reading E2EE private message payloads.
- **API & Database References**: See `backend/docs/API.md`, `backend/docs/DATABASE.md`, and runtime Swagger docs at `/api/v1/docs`.
