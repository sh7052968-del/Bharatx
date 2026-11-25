-- ConnectX Enterprise PostgreSQL Initial Migration (20261125000000_init)
-- Domains A-K: User, Chat, Group, Community, Business, Calling, Notification,
-- Admin, Feature Control, Billing, and System Operations.
-- All timestamps are UTC TIMESTAMPTZ. Plaintext passwords and private E2EE keys are never stored.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'DEPT_ADMIN', 'BUSINESS_MANAGER', 'AGENT', 'MEMBER');
CREATE TYPE "PresenceStatus" AS ENUM ('ONLINE', 'AWAY', 'BUSY', 'OFFLINE');
CREATE TYPE "OtpChannel" AS ENUM ('EMAIL', 'MOBILE', 'PASSWORD_RESET');
CREATE TYPE "ConversationType" AS ENUM ('PRIVATE', 'GROUP', 'SUPPORT');
CREATE TYPE "ConversationMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'SYSTEM');
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "CommunityMemberRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');
CREATE TYPE "CallType" AS ENUM ('VOICE', 'VIDEO', 'GROUP');
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'MISSED', 'DECLINED');
CREATE TYPE "CallParticipantStatus" AS ENUM ('INVITED', 'JOINED', 'LEFT', 'DECLINED');
CREATE TYPE "BusinessVerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'UNCONFIGURED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'OPEN', 'REFUNDED');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- A. USER SYSTEM & H. ADMIN BASE ROLES
CREATE TABLE "admin_roles" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_roles_name_key" UNIQUE ("name")
);

CREATE TABLE "users" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "username" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "avatar_url" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
  "custom_role_id" TEXT,
  "department" TEXT NOT NULL DEFAULT 'General',
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "phone_verified" BOOLEAN NOT NULL DEFAULT false,
  "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  "mfa_secret_encrypted" TEXT,
  "presence_status" "PresenceStatus" NOT NULL DEFAULT 'OFFLINE',
  "last_seen_at" TIMESTAMPTZ(3),
  "show_last_seen" BOOLEAN NOT NULL DEFAULT true,
  "show_profile_photo" BOOLEAN NOT NULL DEFAULT true,
  "read_receipts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "suspended" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMPTZ(3),
  "retention_until" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email"),
  CONSTRAINT "users_phone_key" UNIQUE ("phone"),
  CONSTRAINT "users_username_key" UNIQUE ("username"),
  CONSTRAINT "users_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "admin_roles"("id") ON DELETE SET NULL
);

CREATE TABLE "user_profiles" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "bio" TEXT,
  "job_title" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "avatar_url" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_credentials" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "hash_algorithm" TEXT NOT NULL DEFAULT 'argon2id',
  "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  "mfa_secret_encrypted" TEXT,
  "backup_codes_hash_json" JSONB,
  "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_credentials_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "user_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_devices" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "device_fingerprint" TEXT NOT NULL,
  "device_name" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "os_version" TEXT,
  "trusted" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_devices_user_id_device_fingerprint_key" UNIQUE ("user_id", "device_fingerprint"),
  CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_sessions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "device_id" TEXT,
  "device_name" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip_address" TEXT,
  "refresh_token_hash" TEXT NOT NULL,
  "refresh_token_family" TEXT NOT NULL,
  "token_version" INTEGER NOT NULL DEFAULT 1,
  "revoked_at" TIMESTAMPTZ(3),
  "last_active_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL
);

CREATE TABLE "otp_verifications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "channel" "OtpChannel" NOT NULL,
  "code_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "otp_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_privacy_settings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "show_last_seen" BOOLEAN NOT NULL DEFAULT true,
  "show_profile_photo" BOOLEAN NOT NULL DEFAULT true,
  "read_receipts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "allow_group_invites" BOOLEAN NOT NULL DEFAULT true,
  "allow_calls_from" TEXT NOT NULL DEFAULT 'EVERYONE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_privacy_settings_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_key_bundles" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "identity_public_key" TEXT NOT NULL,
  "signed_pre_key" TEXT NOT NULL,
  "signed_pre_key_signature" TEXT NOT NULL,
  "one_time_pre_keys_json" JSONB NOT NULL,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_key_bundles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_key_bundles_user_id_device_id_key" UNIQUE ("user_id", "device_id"),
  CONSTRAINT "user_key_bundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_contacts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_id" TEXT NOT NULL,
  "contact_user_id" TEXT NOT NULL,
  "nickname" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_contacts_owner_id_contact_user_id_key" UNIQUE ("owner_id", "contact_user_id"),
  CONSTRAINT "user_contacts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_contacts_contact_user_id_fkey" FOREIGN KEY ("contact_user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "user_blocks" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "blocker_id" TEXT NOT NULL,
  "blocked_id" TEXT NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_blocks_blocker_id_blocked_id_key" UNIQUE ("blocker_id", "blocked_id"),
  CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "abuse_reports" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "reporter_id" TEXT NOT NULL,
  "target_user_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "abuse_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "abuse_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- K. MEDIA OBJECTS (referenced by B. message_attachments)
CREATE TABLE "media_objects" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_id" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256_checksum" TEXT NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "retention_until" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_objects_storage_key_key" UNIQUE ("storage_key"),
  CONSTRAINT "media_objects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- B. CHAT SYSTEM
CREATE TABLE "conversations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "type" "ConversationType" NOT NULL DEFAULT 'PRIVATE',
  "title" TEXT,
  "is_encrypted" BOOLEAN NOT NULL DEFAULT true,
  "disappearing_ttl_seconds" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_members" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "ConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
  "muted_until" TIMESTAMPTZ(3),
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversation_members_conversation_id_user_id_key" UNIQUE ("conversation_id", "user_id"),
  CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "messages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
  "is_encrypted" BOOLEAN NOT NULL DEFAULT true,
  "plaintext_body" TEXT,
  "ciphertext" TEXT,
  "nonce" TEXT,
  "sender_key_version" INTEGER,
  "media_url" TEXT,
  "media_mime_type" TEXT,
  "media_size_bytes" INTEGER,
  "reply_to_id" TEXT,
  "forwarded_from_id" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "edited_at" TIMESTAMPTZ(3),
  "deleted_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3),
  "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
  "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_e2ee_no_plaintext_chk" CHECK (NOT ("is_encrypted" = true AND "plaintext_body" IS NOT NULL)),
  CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "message_receipts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "delivered_at" TIMESTAMPTZ(3),
  "read_at" TIMESTAMPTZ(3),
  CONSTRAINT "message_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_receipts_message_id_user_id_key" UNIQUE ("message_id", "user_id"),
  CONSTRAINT "message_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
  CONSTRAINT "message_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "message_reactions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_reactions_message_id_user_id_emoji_key" UNIQUE ("message_id", "user_id", "emoji"),
  CONSTRAINT "message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
  CONSTRAINT "message_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "message_attachments" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "message_id" TEXT NOT NULL,
  "media_object_id" TEXT,
  "storage_url" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256_checksum" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
  CONSTRAINT "message_attachments_media_object_id_fkey" FOREIGN KEY ("media_object_id") REFERENCES "media_objects"("id") ON DELETE SET NULL
);

CREATE TABLE "message_edits" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "message_id" TEXT NOT NULL,
  "editor_id" TEXT NOT NULL,
  "previous_body_hash" TEXT,
  "edited_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_edits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_edits_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
);

CREATE TABLE "message_deletions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "message_id" TEXT NOT NULL,
  "deleted_by_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'FOR_EVERYONE',
  "deleted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_deletions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_deletions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
);

CREATE TABLE "pinned_messages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "pinned_by_id" TEXT NOT NULL,
  "pinned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pinned_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pinned_messages_conversation_id_message_id_key" UNIQUE ("conversation_id", "message_id"),
  CONSTRAINT "pinned_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
);

CREATE TABLE "starred_messages" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "starred_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "starred_messages_message_id_user_id_key" UNIQUE ("message_id", "user_id"),
  CONSTRAINT "starred_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE,
  CONSTRAINT "starred_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- D. COMMUNITY SYSTEM & C. GROUP SYSTEM
CREATE TABLE "communities" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_by_id" TEXT NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "groups" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "invite_code" TEXT NOT NULL,
  "announcements_only" BOOLEAN NOT NULL DEFAULT false,
  "only_admins_can_edit_info" BOOLEAN NOT NULL DEFAULT true,
  "only_admins_can_invite" BOOLEAN NOT NULL DEFAULT true,
  "community_id" TEXT,
  "created_by_id" TEXT NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "groups_conversation_id_key" UNIQUE ("conversation_id"),
  CONSTRAINT "groups_invite_code_key" UNIQUE ("invite_code"),
  CONSTRAINT "groups_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
  CONSTRAINT "groups_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL
);

CREATE TABLE "group_roles" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "group_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_roles_group_id_name_key" UNIQUE ("group_id", "name"),
  CONSTRAINT "group_roles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
);

CREATE TABLE "group_members" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role_id" TEXT,
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id"),
  CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE,
  CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "group_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "group_roles"("id") ON DELETE SET NULL
);

CREATE TABLE "group_permissions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "group_id" TEXT NOT NULL,
  "permission_key" TEXT NOT NULL,
  "allowed_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_permissions_group_id_permission_key_key" UNIQUE ("group_id", "permission_key"),
  CONSTRAINT "group_permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
);

CREATE TABLE "group_invites" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "group_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "max_uses" INTEGER,
  "uses_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "group_invites_code_key" UNIQUE ("code"),
  CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
);

CREATE TABLE "community_members" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "community_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "CommunityMemberRole" NOT NULL DEFAULT 'MEMBER',
  "can_moderate" BOOLEAN NOT NULL DEFAULT false,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_members_community_id_user_id_key" UNIQUE ("community_id", "user_id"),
  CONSTRAINT "community_members_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
  CONSTRAINT "community_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "community_groups" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "community_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "linked_by_id" TEXT NOT NULL,
  "linked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_groups_community_id_group_id_key" UNIQUE ("community_id", "group_id"),
  CONSTRAINT "community_groups_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
  CONSTRAINT "community_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE
);

CREATE TABLE "community_announcements" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "community_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_announcements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "community_announcements_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
);

-- E. BUSINESS SYSTEM
CREATE TABLE "business_categories" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_categories_slug_key" UNIQUE ("slug")
);

CREATE TABLE "business_accounts" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_id" TEXT NOT NULL,
  "business_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "category_id" TEXT,
  "description" TEXT,
  "verification_status" "BusinessVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "greeting_enabled" BOOLEAN NOT NULL DEFAULT false,
  "greeting_text" TEXT,
  "away_enabled" BOOLEAN NOT NULL DEFAULT false,
  "away_text" TEXT,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_accounts_owner_id_key" UNIQUE ("owner_id"),
  CONSTRAINT "business_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "business_accounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "business_categories"("id") ON DELETE SET NULL
);

CREATE TABLE "business_verifications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "registration_no" TEXT,
  "document_url" TEXT,
  "status" "BusinessVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT,
  "review_notes" TEXT,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(3),
  CONSTRAINT "business_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_verifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE
);

CREATE TABLE "business_catalogs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_catalogs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_catalogs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE
);

CREATE TABLE "products" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "catalog_id" TEXT,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "in_stock" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_price_nonneg_chk" CHECK ("price_cents" >= 0),
  CONSTRAINT "products_business_id_sku_key" UNIQUE ("business_id", "sku"),
  CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "products_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "business_catalogs"("id") ON DELETE SET NULL
);

CREATE TABLE "product_images" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "product_id" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE TABLE "customer_labels" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color_hex" TEXT NOT NULL DEFAULT '#0D6E52',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_labels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_labels_business_id_name_key" UNIQUE ("business_id", "name"),
  CONSTRAINT "customer_labels_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE
);

CREATE TABLE "customers" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "customer_user_id" TEXT,
  "customer_name" TEXT NOT NULL,
  "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE
);

CREATE TABLE "customer_notes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "customer_record_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_notes_customer_record_id_fkey" FOREIGN KEY ("customer_record_id") REFERENCES "customers"("id") ON DELETE CASCADE
);

CREATE TABLE "quick_replies" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "shortcut" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quick_replies_business_id_shortcut_key" UNIQUE ("business_id", "shortcut"),
  CONSTRAINT "quick_replies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE
);

CREATE TABLE "business_automations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "message_text" TEXT NOT NULL,
  "schedule_json" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_automations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_automations_business_id_trigger_type_key" UNIQUE ("business_id", "trigger_type"),
  CONSTRAINT "business_automations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE
);

CREATE TABLE "business_orders" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "business_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "total_cents" INTEGER NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_orders_arithmetic_chk" CHECK ("quantity" > 0 AND "unit_price_cents" >= 0 AND "total_cents" = "quantity" * "unit_price_cents"),
  CONSTRAINT "business_orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "business_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "business_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);

-- F. CALLING SYSTEM
CREATE TABLE "calls" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "conversation_id" TEXT,
  "initiator_id" TEXT NOT NULL,
  "call_type" "CallType" NOT NULL DEFAULT 'VOICE',
  "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
  "started_at" TIMESTAMPTZ(3),
  "ended_at" TIMESTAMPTZ(3),
  "duration_seconds" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL,
  CONSTRAINT "calls_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "call_participants" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "call_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "CallParticipantStatus" NOT NULL DEFAULT 'INVITED',
  "joined_at" TIMESTAMPTZ(3),
  "left_at" TIMESTAMPTZ(3),
  CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_participants_call_id_user_id_key" UNIQUE ("call_id", "user_id"),
  CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE,
  CONSTRAINT "call_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "call_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "call_id" TEXT NOT NULL,
  "actor_id" TEXT,
  "event_type" TEXT NOT NULL,
  "payload_json" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_events_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE
);

-- G. NOTIFICATION SYSTEM
CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "message_alerts" BOOLEAN NOT NULL DEFAULT true,
  "call_alerts" BOOLEAN NOT NULL DEFAULT true,
  "group_alerts" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "push_subscriptions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint"),
  CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "event_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "metadata_json" JSONB,
  "delivery_status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "notification_jobs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "notification_id" TEXT NOT NULL,
  "queue_name" TEXT NOT NULL DEFAULT 'connectx.notifications',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "last_error" TEXT,
  "next_retry_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_jobs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE
);

CREATE TABLE "notification_templates" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "template_key" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "subject_template" TEXT NOT NULL,
  "body_template" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_templates_template_key_key" UNIQUE ("template_key")
);

-- H. ADMIN SYSTEM
CREATE TABLE "admin_users" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "department" TEXT NOT NULL DEFAULT 'Platform',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_users_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "admin_permissions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_permissions_code_key" UNIQUE ("code")
);

CREATE TABLE "admin_user_roles" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "admin_user_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_user_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_user_roles_admin_user_id_role_id_key" UNIQUE ("admin_user_id", "role_id"),
  CONSTRAINT "admin_user_roles_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE,
  CONSTRAINT "admin_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE
);

CREATE TABLE "admin_role_permissions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "role_id" TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_role_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id"),
  CONSTRAINT "admin_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "admin_roles"("id") ON DELETE CASCADE,
  CONSTRAINT "admin_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "admin_permissions"("id") ON DELETE CASCADE
);

CREATE TABLE "admin_activity_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "actor_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "ip_address" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "admin_approvals" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "workflow_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_approvals_pkey" PRIMARY KEY ("id")
);

-- I. FEATURE CONTROL SYSTEM
CREATE TABLE "feature_modules" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_modules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_modules_key_key" UNIQUE ("key")
);

CREATE TABLE "feature_flags" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "module_id" TEXT,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "rollout_percent" INTEGER NOT NULL DEFAULT 100,
  "updated_by_id" TEXT,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_flags_key_key" UNIQUE ("key"),
  CONSTRAINT "feature_flags_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "feature_modules"("id") ON DELETE SET NULL
);

CREATE TABLE "feature_dependencies" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "module_id" TEXT NOT NULL,
  "depends_on_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_dependencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_dependencies_module_id_depends_on_id_key" UNIQUE ("module_id", "depends_on_id"),
  CONSTRAINT "feature_dependencies_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "feature_modules"("id") ON DELETE CASCADE,
  CONSTRAINT "feature_dependencies_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "feature_modules"("id") ON DELETE CASCADE
);

CREATE TABLE "app_settings" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "key" TEXT NOT NULL,
  "value_json" JSONB NOT NULL,
  "updated_by_id" TEXT,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_settings_key_key" UNIQUE ("key")
);

CREATE TABLE "app_releases" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "platform" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "build_number" INTEGER NOT NULL,
  "min_supported" BOOLEAN NOT NULL DEFAULT true,
  "release_notes" TEXT,
  "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "app_releases_platform_version_key" UNIQUE ("platform", "version")
);

-- J. BILLING SYSTEM
CREATE TABLE "subscription_plans" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "monthly_price_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "features_json" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_plans_code_key" UNIQUE ("code")
);

CREATE TABLE "user_subscriptions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_period_end" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT
);

CREATE TABLE "payment_transactions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'STRIPE',
  "provider_tx_id" TEXT,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_transactions_provider_tx_id_key" UNIQUE ("provider_tx_id"),
  CONSTRAINT "payment_transactions_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "payment_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "transaction_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "InvoiceStatus" NOT NULL DEFAULT 'PAID',
  "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number"),
  CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT
);

CREATE TABLE "refunds" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "transaction_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "payment_transactions"("id") ON DELETE CASCADE
);

-- K. SYSTEM OPERATIONS
CREATE TABLE "upload_sessions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "expected_bytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "upload_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "support_tickets" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "system_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "level" TEXT NOT NULL DEFAULT 'INFO',
  "service" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "context_json" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_announcements" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "author_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "backup_records" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "backup_type" TEXT NOT NULL DEFAULT 'FULL_POSTGRES',
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "checksum_sha256" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "triggered_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_records" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "response_json" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_user_id_idempotency_key_method_path_key" UNIQUE ("user_id", "idempotency_key", "method", "path")
);
