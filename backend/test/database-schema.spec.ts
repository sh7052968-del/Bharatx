import * as fs from 'fs';
import * as path from 'path';

describe('ConnectX Enterprise Database Schema & Migrations', () => {
  const prismaDir = path.resolve(__dirname, '../prisma');
  const schemaPath = path.join(prismaDir, 'schema.prisma');
  const initMigrationPath = path.join(
    prismaDir,
    'migrations/20261125000000_init/migration.sql',
  );
  const partitionMigrationPath = path.join(
    prismaDir,
    'migrations/20261125010000_partitioning_indexes_retention/migration.sql',
  );
  const seedPath = path.join(prismaDir, 'seed.ts');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const initSql = fs.readFileSync(initMigrationPath, 'utf8');
  const partitionSql = fs.readFileSync(partitionMigrationPath, 'utf8');
  const seedSource = fs.readFileSync(seedPath, 'utf8');

  const requiredTablesByDomain: Record<string, string[]> = {
    'A. User System': [
      'users',
      'user_profiles',
      'user_credentials',
      'user_sessions',
      'user_devices',
      'otp_verifications',
      'user_privacy_settings',
      'user_contacts',
      'user_blocks',
    ],
    'B. Chat System': [
      'conversations',
      'conversation_members',
      'messages',
      'message_receipts',
      'message_reactions',
      'message_attachments',
      'message_edits',
      'message_deletions',
      'pinned_messages',
      'starred_messages',
    ],
    'C. Group System': [
      'groups',
      'group_members',
      'group_roles',
      'group_permissions',
      'group_invites',
    ],
    'D. Community System': [
      'communities',
      'community_members',
      'community_groups',
      'community_announcements',
    ],
    'E. Business System': [
      'business_accounts',
      'business_verifications',
      'business_categories',
      'business_catalogs',
      'products',
      'product_images',
      'customers',
      'customer_labels',
      'customer_notes',
      'business_orders',
      'quick_replies',
      'business_automations',
    ],
    'F. Calling System': ['calls', 'call_participants', 'call_events'],
    'G. Notification System': [
      'notifications',
      'notification_preferences',
      'notification_jobs',
      'notification_templates',
    ],
    'H. Admin System': [
      'admin_users',
      'admin_roles',
      'admin_permissions',
      'admin_user_roles',
      'admin_role_permissions',
      'admin_activity_logs',
      'admin_approvals',
    ],
    'I. Feature Control System': [
      'feature_modules',
      'feature_flags',
      'feature_dependencies',
      'app_settings',
      'app_releases',
    ],
    'J. Billing System': [
      'subscription_plans',
      'user_subscriptions',
      'payment_transactions',
      'invoices',
      'refunds',
    ],
    'K. System Operations': [
      'media_objects',
      'upload_sessions',
      'support_tickets',
      'system_logs',
      'backup_records',
    ],
  };

  it('maps every required Domain A-K table in Prisma schema and creates it in initial SQL migration', () => {
    for (const [, tables] of Object.entries(requiredTablesByDomain)) {
      for (const table of tables) {
        expect(schemaContent).toContain(`@@map("${table}")`);
        expect(initSql).toContain(`CREATE TABLE "${table}" (`);
      }
    }
  });

  it('uses UTC TIMESTAMPTZ(3) timestamps and enforces E2EE & deterministic order check constraints', () => {
    expect(initSql).toContain('TIMESTAMPTZ(3)');
    expect(initSql).toContain('CONSTRAINT "messages_e2ee_no_plaintext_chk"');
    expect(initSql).toContain(
      'CHECK (NOT ("is_encrypted" = true AND "plaintext_body" IS NOT NULL))',
    );
    expect(initSql).toContain('CONSTRAINT "business_orders_arithmetic_chk"');
    expect(initSql).toContain(
      'CHECK ("quantity" > 0 AND "unit_price_cents" >= 0 AND "total_cents" = "quantity" * "unit_price_cents")',
    );
  });

  it('defines partial cursor indexes, GIN tag index, BRIN partitioned tables, and retention purge procedure', () => {
    expect(partitionSql).toContain(
      'CREATE INDEX "messages_cursor_active_idx" ON "messages"',
    );
    expect(partitionSql).toContain('USING GIN ("labels")');
    expect(partitionSql).toContain('USING BRIN ("created_at")');
    expect(partitionSql).toContain(
      'CREATE TABLE "messages_archive_partitioned"',
    );
    expect(partitionSql).toContain('PARTITION BY RANGE ("created_at")');
    expect(partitionSql).toContain('CREATE TABLE "system_logs_partitioned"');
    expect(partitionSql).toContain(
      'CREATE OR REPLACE FUNCTION "purge_expired_connectx_records"()',
    );
  });

  it('never stores plaintext passwords or private encryption keys and maintains zero AI tables', () => {
    expect(schemaContent).not.toMatch(/\bpassword\b\s+String/);
    expect(schemaContent).not.toMatch(/private_key/i);
    expect(schemaContent).not.toMatch(/mfa_secret\b(?!_encrypted)/i);
    expect(schemaContent).not.toMatch(/@@map\("[^"]*(ai_|llm_|chatbot|embedding)/i);
    expect(initSql).not.toMatch(/CREATE TABLE "[^"]*(ai_|llm_|chatbot|embedding)/i);
  });

  it('contains idempotent seed upserts without fake people or fake catalog items', () => {
    expect(seedSource).toContain('prisma.adminPermission.upsert');
    expect(seedSource).toContain('prisma.subscriptionPlan.upsert');
    expect(seedSource).toContain('prisma.featureModule.upsert');
    expect(seedSource).not.toContain('prisma.user.create');
    expect(seedSource).not.toContain('prisma.product.create');
  });
});
