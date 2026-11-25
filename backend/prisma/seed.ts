import { NotificationChannel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Idempotent development/reference seed script for ConnectX.
 * Seeds structural system configuration, RBAC permissions/roles, feature modules & flags,
 * business categories, notification templates, subscription plans, and release metadata.
 * Contains zero fake people, fake users, or fake marketplace listings.
 */
async function main(): Promise<void> {
  // 1. Admin Permissions (Module-Level Read/Write/Delete/Approve/Export)
  const permissions = [
    { code: 'overview:read', description: 'View aggregate platform telemetry and health metrics' },
    { code: 'users:read', description: 'View workspace user directory metadata' },
    { code: 'users:write', description: 'Verify, suspend, ban, or restore user accounts' },
    { code: 'users:delete', description: 'Delete or purge non-admin accounts' },
    { code: 'admins:read', description: 'Inspect administrator roster and login sessions' },
    { code: 'admins:write', description: 'Manage administrator assignments and restrictions' },
    { code: 'roles:manage', description: 'Create and edit custom roles and permissions' },
    { code: 'features:read', description: 'Inspect modules, flags, dependencies, and rollout snapshots' },
    { code: 'features:write', description: 'Configure feature flags, rollout %, and module settings' },
    { code: 'business:read', description: 'View business accounts and product catalogs' },
    { code: 'business:write', description: 'Restrict businesses or moderate catalog items' },
    { code: 'business:approve', description: 'Approve or reject business verifications' },
    { code: 'moderation:read', description: 'Review user, group, and business abuse reports' },
    { code: 'moderation:write', description: 'Execute moderation decisions and warnings' },
    { code: 'finance:read', description: 'Inspect plans, payments, invoices, and refund queues' },
    { code: 'finance:write', description: 'Configure subscription plans and submit refunds' },
    { code: 'finance:approve', description: 'Approve or reject customer refund requests' },
    { code: 'notifications:read', description: 'View announcements and notification templates' },
    { code: 'notifications:write', description: 'Publish announcements and dispatch campaigns' },
    { code: 'analytics:read', description: 'Inspect deterministic growth and storage reports' },
    { code: 'analytics:export', description: 'Export CSV and PDF analytical reports' },
    { code: 'settings:read', description: 'Inspect branding, localization, privacy, and app settings' },
    { code: 'settings:write', description: 'Modify platform settings and maintenance mode' },
    { code: 'audit:read', description: 'Inspect tamper-evident admin activity logs' },
    { code: 'developer:read', description: 'Inspect release registry and queue telemetry' },
    { code: 'developer:write', description: 'Register staging releases and request production promotion' },
    { code: 'approvals:review', description: 'Approve or reject sensitive pending workflows' },
    { code: 'system:config', description: 'Manage global app settings and feature flags' },
    { code: 'system:backup', description: 'Trigger and inspect database backup manifests' },
  ];

  for (const perm of permissions) {
    await prisma.adminPermission.upsert({
      where: { code: perm.code },
      update: { description: perm.description },
      create: perm,
    });
  }

  // 2. Reference Admin Roles + Role-Permission Links
  const roleTemplates = [
    {
      name: 'Platform Admin',
      description: 'Operates feature control, notifications, analytics, settings, and staging releases',
      permissions: ['overview:read', 'users:read', 'users:write', 'features:read', 'features:write', 'business:read', 'notifications:read', 'notifications:write', 'analytics:read', 'analytics:export', 'settings:read', 'settings:write', 'developer:read', 'developer:write', 'approvals:review'],
    },
    {
      name: 'Security Admin',
      description: 'Manages sessions, suspensions/bans, admin login audits, and security controls',
      permissions: ['overview:read', 'users:read', 'users:write', 'users:delete', 'admins:read', 'admins:write', 'audit:read', 'moderation:read', 'moderation:write', 'settings:read', 'settings:write', 'approvals:review'],
    },
    {
      name: 'Business Admin',
      description: 'Reviews business verifications, catalogs, and merchant restrictions',
      permissions: ['overview:read', 'business:read', 'business:write', 'business:approve', 'moderation:read', 'analytics:read', 'analytics:export', 'approvals:review'],
    },
    {
      name: 'Finance Admin',
      description: 'Manages subscription plans, payment transactions, invoices, and refund approvals',
      permissions: ['overview:read', 'finance:read', 'finance:write', 'finance:approve', 'analytics:read', 'analytics:export', 'audit:read', 'approvals:review'],
    },
    {
      name: 'Content Moderator',
      description: 'Reviews abuse reports across users, groups, and businesses with audit trails',
      permissions: ['overview:read', 'users:read', 'users:write', 'business:read', 'moderation:read', 'moderation:write', 'audit:read'],
    },
    {
      name: 'Customer Support Admin',
      description: 'Handles user account assistance and support notifications without billing/release access',
      permissions: ['overview:read', 'users:read', 'users:write', 'moderation:read', 'notifications:read', 'notifications:write'],
    },
    {
      name: 'Compliance Reviewer',
      description: 'Reviews business verification and refund approval workflows without message access',
      permissions: ['users:read', 'approvals:review', 'audit:read'],
    },
  ];

  for (const tpl of roleTemplates) {
    const role = await prisma.customAdminRole.upsert({
      where: { name: tpl.name },
      update: { description: tpl.description, permissions: tpl.permissions },
      create: {
        name: tpl.name,
        description: tpl.description,
        permissions: tpl.permissions,
        createdById: 'SYSTEM_SEED',
      },
    });
    for (const code of tpl.permissions) {
      const perm = await prisma.adminPermission.findUnique({ where: { code } });
      if (perm) {
        await prisma.adminRolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // 3. Business Categories
  const categories = [
    { slug: 'software-saas', name: 'Software & SaaS', description: 'Cloud and enterprise software providers' },
    { slug: 'retail-commerce', name: 'Retail & Commerce', description: 'Direct-to-customer retail catalogs' },
    { slug: 'professional-services', name: 'Professional Services', description: 'Consulting, legal, and operations' },
    { slug: 'logistics-supply', name: 'Logistics & Supply', description: 'Fulfillment and transport operations' },
  ];
  for (const cat of categories) {
    await prisma.businessCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }

  // 4. Feature Modules, Flags, and Dependencies
  const messagingMod = await prisma.featureModule.upsert({
    where: { key: 'messaging_e2ee' },
    update: { name: 'End-to-End Encrypted Messaging', enabled: true },
    create: { key: 'messaging_e2ee', name: 'End-to-End Encrypted Messaging', enabled: true },
  });
  const callingMod = await prisma.featureModule.upsert({
    where: { key: 'webrtc_calling' },
    update: { name: 'WebRTC Voice & Video Calling', enabled: true },
    create: { key: 'webrtc_calling', name: 'WebRTC Voice & Video Calling', enabled: true },
  });

  await prisma.featureDependency.upsert({
    where: { moduleId_dependsOnId: { moduleId: callingMod.id, dependsOnId: messagingMod.id } },
    update: {},
    create: { moduleId: callingMod.id, dependsOnId: messagingMod.id },
  });

  const flags = [
    { key: 'e2ee_private_chats', enabled: true, moduleId: messagingMod.id, rolloutPercent: 100 },
    { key: 'group_video_calls', enabled: true, moduleId: callingMod.id, rolloutPercent: 100 },
    { key: 'disappearing_messages', enabled: true, moduleId: messagingMod.id, rolloutPercent: 100 },
  ];
  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: { enabled: flag.enabled, moduleId: flag.moduleId, rolloutPercent: flag.rolloutPercent },
      create: flag,
    });
  }

  // 5. App Settings & Releases
  await prisma.systemConfig.upsert({
    where: { key: 'maintenance_mode' },
    update: {},
    create: { key: 'maintenance_mode', valueJson: { enabled: false, reason: null } },
  });
  await prisma.systemConfig.upsert({
    where: { key: 'retention_policy_days' },
    update: {},
    create: { key: 'retention_policy_days', valueJson: { systemLogs: 90, idempotencyHours: 24 } },
  });
  await prisma.appRelease.upsert({
    where: { platform_version: { platform: 'ANDROID', version: '2.0.0' } },
    update: { buildNumber: 200, minSupported: true },
    create: {
      platform: 'ANDROID',
      version: '2.0.0',
      buildNumber: 200,
      minSupported: true,
      releaseNotes: 'ConnectX Enterprise Android + NestJS Backend baseline',
    },
  });

  // 6. Notification Templates
  const templates = [
    {
      templateKey: 'auth.otp.email',
      channel: NotificationChannel.EMAIL,
      subjectTemplate: 'ConnectX Security Verification Code',
      bodyTemplate: 'Your verification code is {{code}}. Valid for 10 minutes.',
      locale: 'en',
    },
    {
      templateKey: 'call.incoming.inapp',
      channel: NotificationChannel.IN_APP,
      subjectTemplate: 'Incoming {{callType}} Call',
      bodyTemplate: '{{callerName}} is calling you on ConnectX.',
      locale: 'en',
    },
  ];
  for (const tpl of templates) {
    await prisma.notificationTemplate.upsert({
      where: { templateKey: tpl.templateKey },
      update: { subjectTemplate: tpl.subjectTemplate, bodyTemplate: tpl.bodyTemplate },
      create: tpl,
    });
  }

  // 7. Subscription Plans (Deterministic Tier Catalog)
  const plans = [
    {
      code: 'STARTER',
      name: 'Starter',
      monthlyPriceCents: 0,
      currency: 'USD',
      featuresJson: ['E2EE private messaging', 'Groups & communities', 'Standard voice/video calls'],
    },
    {
      code: 'GROWTH',
      name: 'Growth Pro',
      monthlyPriceCents: 2900,
      currency: 'USD',
      featuresJson: ['Verified business profile', 'Product catalogs & orders', 'CRM labels & quick replies'],
    },
    {
      code: 'ENTERPRISE',
      name: 'Enterprise Desk',
      monthlyPriceCents: 9900,
      currency: 'USD',
      featuresJson: ['Custom RBAC roles', 'Approval workflows & audit trail', 'Priority support SLAs'],
    },
  ];
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: { name: plan.name, monthlyPriceCents: plan.monthlyPriceCents, featuresJson: plan.featuresJson },
      create: plan,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error('Seed failed:', err);
    await prisma.$disconnect();
    throw err;
  });
