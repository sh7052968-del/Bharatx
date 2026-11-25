-- ConnectX PostgreSQL Schema & Security Verification Script
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/prisma/scripts/verify-schema.sql

-- 1. Verify all core tables exist across Domains A-K
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Verify E2EE check constraint exists on messages
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'messages_e2ee_no_plaintext_chk';

-- 3. Verify deterministic order arithmetic check constraint exists on business_orders
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'business_orders_arithmetic_chk';

-- 4. Verify partitioned tables & active partitions
SELECT parent.relname AS partitioned_table, child.relname AS partition_name
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
ORDER BY parent.relname, child.relname;

-- 5. Verify seeded reference counts
SELECT
  (SELECT COUNT(*) FROM admin_permissions) AS seeded_permissions,
  (SELECT COUNT(*) FROM business_categories) AS seeded_categories,
  (SELECT COUNT(*) FROM feature_modules) AS seeded_feature_modules,
  (SELECT COUNT(*) FROM subscription_plans) AS seeded_plans;
