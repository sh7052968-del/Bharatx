-- ConnectX Enterprise Migration 2 (20261125010000_partitioning_indexes_retention)
-- Adds composite cursor pagination indexes, partial soft-delete indexes, GIN indexes,
-- declarative monthly range partitioning for high-volume archive & log telemetry,
-- and deterministic data retention cleanup routines.

-- 1. High-throughput cursor pagination & partial active-record indexes
CREATE INDEX "users_active_presence_idx" ON "users" ("presence_status", "last_seen_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "user_sessions_active_idx" ON "user_sessions" ("user_id", "expires_at") WHERE "revoked_at" IS NULL;
CREATE INDEX "user_devices_active_idx" ON "user_devices" ("user_id") WHERE "revoked_at" IS NULL;
CREATE INDEX "otp_verifications_lookup_idx" ON "otp_verifications" ("user_id", "channel", "expires_at") WHERE "consumed_at" IS NULL;
CREATE INDEX "conversations_updated_active_idx" ON "conversations" ("updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "conversation_members_user_archived_idx" ON "conversation_members" ("user_id", "archived");
CREATE INDEX "messages_cursor_active_idx" ON "messages" ("conversation_id", "created_at" DESC, "id") WHERE "deleted_at" IS NULL;
CREATE INDEX "messages_expires_idx" ON "messages" ("expires_at") WHERE "expires_at" IS NOT NULL;
CREATE INDEX "messages_sender_idx" ON "messages" ("sender_id", "created_at" DESC);
CREATE INDEX "message_receipts_unread_idx" ON "message_receipts" ("user_id", "read_at") WHERE "read_at" IS NULL;
CREATE INDEX "message_reactions_msg_idx" ON "message_reactions" ("message_id");
CREATE INDEX "message_attachments_msg_idx" ON "message_attachments" ("message_id");
CREATE INDEX "message_edits_msg_idx" ON "message_edits" ("message_id", "edited_at" DESC);
CREATE INDEX "starred_messages_user_idx" ON "starred_messages" ("user_id", "created_at" DESC);
CREATE INDEX "groups_community_idx" ON "groups" ("community_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "group_members_user_idx" ON "group_members" ("user_id");
CREATE INDEX "group_invites_active_idx" ON "group_invites" ("group_id", "expires_at") WHERE "revoked_at" IS NULL;
CREATE INDEX "community_announcements_feed_idx" ON "community_announcements" ("community_id", "pinned" DESC, "created_at" DESC);
CREATE INDEX "business_orders_merchant_idx" ON "business_orders" ("business_id", "status", "created_at" DESC);
CREATE INDEX "business_orders_customer_idx" ON "business_orders" ("customer_id", "created_at" DESC);
CREATE INDEX "customers_labels_gin_idx" ON "customers" USING GIN ("labels");
CREATE INDEX "calls_initiator_idx" ON "calls" ("initiator_id", "created_at" DESC);
CREATE INDEX "call_events_call_idx" ON "call_events" ("call_id", "created_at");
CREATE INDEX "notifications_inbox_idx" ON "notifications" ("user_id", "created_at" DESC) WHERE "read_at" IS NULL;
CREATE INDEX "notification_jobs_retry_idx" ON "notification_jobs" ("status", "next_retry_at");
CREATE INDEX "admin_activity_logs_time_idx" ON "admin_activity_logs" ("created_at" DESC);
CREATE INDEX "admin_approvals_queue_idx" ON "admin_approvals" ("status", "workflow_type", "created_at");
CREATE INDEX "payment_transactions_user_idx" ON "payment_transactions" ("user_id", "created_at" DESC);
CREATE INDEX "invoices_user_idx" ON "invoices" ("user_id", "issued_at" DESC);
CREATE INDEX "support_tickets_queue_idx" ON "support_tickets" ("status", "priority", "created_at" DESC);
CREATE INDEX "system_logs_level_time_idx" ON "system_logs" ("level", "created_at" DESC);
CREATE INDEX "idempotency_expiry_idx" ON "idempotency_records" ("expires_at");

-- 2. Declarative Monthly Range Partitioning for High-Volume Message Archive & Telemetry
CREATE TABLE "messages_archive_partitioned" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "message_type" "MessageType" NOT NULL,
  "is_encrypted" BOOLEAN NOT NULL DEFAULT true,
  "ciphertext" TEXT,
  "nonce" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "archived_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

CREATE TABLE "messages_archive_2026_11" PARTITION OF "messages_archive_partitioned"
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE "messages_archive_2026_12" PARTITION OF "messages_archive_partitioned"
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE "messages_archive_default" PARTITION OF "messages_archive_partitioned" DEFAULT;

CREATE INDEX "messages_archive_conv_brin_idx" ON "messages_archive_partitioned" USING BRIN ("created_at");
CREATE INDEX "messages_archive_conv_btree_idx" ON "messages_archive_partitioned" ("conversation_id", "created_at" DESC);

CREATE TABLE "system_logs_partitioned" (
  "id" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "service" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "context_json" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

CREATE TABLE "system_logs_2026_11" PARTITION OF "system_logs_partitioned"
  FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');
CREATE TABLE "system_logs_2026_12" PARTITION OF "system_logs_partitioned"
  FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
CREATE TABLE "system_logs_default" PARTITION OF "system_logs_partitioned" DEFAULT;

-- 3. Deterministic Data Retention Purge Procedure
CREATE OR REPLACE FUNCTION "purge_expired_connectx_records"()
RETURNS TABLE("purged_messages" INTEGER, "purged_otps" INTEGER, "purged_idempotency" INTEGER) AS $$
DECLARE
  v_msg_count INTEGER;
  v_otp_count INTEGER;
  v_idem_count INTEGER;
BEGIN
  DELETE FROM "messages" WHERE "expires_at" IS NOT NULL AND "expires_at" < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS v_msg_count = ROW_COUNT;

  DELETE FROM "otp_verifications" WHERE "expires_at" < CURRENT_TIMESTAMP - INTERVAL '24 hours';
  GET DIAGNOSTICS v_otp_count = ROW_COUNT;

  DELETE FROM "idempotency_records" WHERE "expires_at" < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS v_idem_count = ROW_COUNT;

  RETURN QUERY SELECT v_msg_count, v_otp_count, v_idem_count;
END;
$$ LANGUAGE plpgsql;
