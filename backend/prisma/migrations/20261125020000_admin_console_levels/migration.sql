-- ConnectX Enterprise Migration 3 (20261125020000_admin_console_levels)
-- Adds explicit Multi-Admin UserRole levels, moderation & ban metadata,
-- business restrictions, feature versioning/eligibility, release staging,
-- and tamper-evident SHA-256 audit log hash chaining.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECURITY_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BUSINESS_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CONTENT_MODERATOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CUSTOM_ADMIN';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "banned_at" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "ban_reason" TEXT;

ALTER TABLE "abuse_reports"
  ADD COLUMN IF NOT EXISTS "target_type" TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS "target_ref_id" TEXT,
  ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "resolved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "abuse_reports_queue_idx"
  ON "abuse_reports" ("status", "target_type", "created_at" DESC);

ALTER TABLE "business_accounts"
  ADD COLUMN IF NOT EXISTS "restricted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "restriction_reason" TEXT;

ALTER TABLE "admin_activity_logs"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'ADMIN_ACTION',
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "entry_hash" TEXT;

CREATE INDEX IF NOT EXISTS "admin_activity_logs_cat_idx"
  ON "admin_activity_logs" ("category", "created_at" DESC);

ALTER TABLE "feature_modules"
  ADD COLUMN IF NOT EXISTS "version" TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS "settings_json" JSONB;

ALTER TABLE "feature_flags"
  ADD COLUMN IF NOT EXISTS "eligibility_json" JSONB;

ALTER TABLE "app_releases"
  ADD COLUMN IF NOT EXISTS "stage" TEXT NOT NULL DEFAULT 'STAGING',
  ADD COLUMN IF NOT EXISTS "checksum_sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;
