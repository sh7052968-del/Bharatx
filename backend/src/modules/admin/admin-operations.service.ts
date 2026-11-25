import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  BusinessVerificationStatus,
  NotificationChannel,
} from '@prisma/client';
import * as crypto from 'crypto';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMqService } from '../../rabbitmq/rabbitmq.module';
import { RedisService } from '../../redis/redis.module';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminService } from './admin.service';
import {
  BroadcastCampaignDto,
  CreateRefundRequestDto,
  CreateReleaseDto,
  ModerateProductDto,
  ModerationDecisionDto,
  RestrictBusinessDto,
  RollbackFeatureConfigDto,
  UpdateFeatureFlagDto,
  UpdateFeatureModuleDto,
  UpdateSystemSettingsDto,
  UpsertNotificationTemplateDto,
  UpsertSubscriptionPlanDto,
  VerifyBusinessDto,
} from './dto/admin.dto';

export interface FeatureHistorySnapshot {
  id: string;
  targetType: 'MODULE' | 'FLAG';
  targetKey: string;
  previousState: Record<string, unknown>;
  changedById: string;
  changedAt: string;
}

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly notifications: NotificationsService,
    private readonly adminService: AdminService,
  ) {}

  // ============================================================================
  // E. FEATURE CONTROL CENTER
  // ============================================================================

  async getFeatureControlState() {
    const [modules, flags, dependencies, historyCfg] = await Promise.all([
      this.prisma.featureModule.findMany({
        include: { parents: { include: { dependsOnModule: true } } },
        orderBy: { key: 'asc' },
      }),
      this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.featureDependency.findMany({
        include: { module: true, dependsOnModule: true },
      }),
      this.prisma.systemConfig.findUnique({ where: { key: 'feature_config_history' } }),
    ]);

    return {
      modules,
      flags,
      dependencies,
      history: ((historyCfg?.valueJson as { snapshots?: FeatureHistorySnapshot[] })?.snapshots ?? []),
    };
  }

  private async appendFeatureHistory(snapshot: FeatureHistorySnapshot) {
    const existing = await this.prisma.systemConfig.findUnique({
      where: { key: 'feature_config_history' },
    });
    const current = (existing?.valueJson as { snapshots?: FeatureHistorySnapshot[] } | null)?.snapshots ?? [];
    const next = [snapshot, ...current].slice(0, 40);
    await this.prisma.systemConfig.upsert({
      where: { key: 'feature_config_history' },
      update: { valueJson: { snapshots: next } as object, updatedById: snapshot.changedById },
      create: { key: 'feature_config_history', valueJson: { snapshots: next } as object, updatedById: snapshot.changedById },
    });
  }

  async updateFeatureModule(actorId: string, key: string, dto: UpdateFeatureModuleDto, ip?: string) {
    const mod = await this.prisma.featureModule.findUnique({ where: { key } });
    if (!mod) throw new NotFoundException('Feature module not found');

    await this.appendFeatureHistory({
      id: crypto.randomUUID(),
      targetType: 'MODULE',
      targetKey: mod.key,
      previousState: {
        enabled: mod.enabled,
        version: mod.version,
        settingsJson: mod.settingsJson,
      },
      changedById: actorId,
      changedAt: new Date().toISOString(),
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const m = await tx.featureModule.update({
        where: { key },
        data: {
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
          ...(dto.version ? { version: dto.version } : {}),
          ...(dto.settingsJson ? { settingsJson: dto.settingsJson as object } : {}),
        },
      });
      if (dto.dependsOnKeys) {
        await tx.featureDependency.deleteMany({ where: { moduleId: m.id } });
        for (const depKey of dto.dependsOnKeys) {
          if (depKey === key) continue;
          const depMod = await tx.featureModule.findUnique({ where: { key: depKey } });
          if (depMod) {
            await tx.featureDependency.create({
              data: { moduleId: m.id, dependsOnId: depMod.id },
            });
          }
        }
      }
      return m;
    });

    await this.adminService.logAction(
      actorId,
      'FEATURE_MODULE_UPDATED',
      'FeatureModule',
      updated.id,
      `Module ${key}: enabled=${updated.enabled}, version=${updated.version}`,
      ip,
      'FEATURE_CONFIG',
    );
    return updated;
  }

  async updateFeatureFlag(actorId: string, key: string, dto: UpdateFeatureFlagDto, ip?: string) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (existing) {
      await this.appendFeatureHistory({
        id: crypto.randomUUID(),
        targetType: 'FLAG',
        targetKey: existing.key,
        previousState: {
          enabled: existing.enabled,
          rolloutPercent: existing.rolloutPercent,
          eligibilityJson: existing.eligibilityJson,
        },
        changedById: actorId,
        changedAt: new Date().toISOString(),
      });
    }

    const updated = await this.prisma.featureFlag.upsert({
      where: { key },
      update: {
        enabled: dto.enabled,
        rolloutPercent: dto.rolloutPercent ?? 100,
        description: dto.description ?? existing?.description ?? null,
        ...(dto.eligibilityJson ? { eligibilityJson: dto.eligibilityJson as object } : {}),
        updatedById: actorId,
      },
      create: {
        key,
        enabled: dto.enabled,
        rolloutPercent: dto.rolloutPercent ?? 100,
        description: dto.description ?? null,
        ...(dto.eligibilityJson ? { eligibilityJson: dto.eligibilityJson as object } : {}),
        updatedById: actorId,
      },
    });

    await this.adminService.logAction(
      actorId,
      'FEATURE_FLAG_UPDATED',
      'FeatureFlag',
      updated.id,
      `Flag ${key}: enabled=${updated.enabled}, rollout=${updated.rolloutPercent}%`,
      ip,
      'FEATURE_CONFIG',
    );
    return updated;
  }

  async rollbackFeatureConfig(actorId: string, dto: RollbackFeatureConfigDto, ip?: string) {
    const historyCfg = await this.prisma.systemConfig.findUnique({
      where: { key: 'feature_config_history' },
    });
    const snapshots = (historyCfg?.valueJson as { snapshots?: FeatureHistorySnapshot[] } | null)?.snapshots ?? [];
    const target = snapshots.find((s) => s.id === dto.snapshotId);
    if (!target) throw new NotFoundException('Feature snapshot not found');

    if (target.targetType === 'FLAG') {
      await this.prisma.featureFlag.update({
        where: { key: target.targetKey },
        data: {
          enabled: Boolean(target.previousState.enabled),
          rolloutPercent: Number(target.previousState.rolloutPercent ?? 100),
          eligibilityJson: (target.previousState.eligibilityJson ?? undefined) as object | undefined,
          updatedById: actorId,
        },
      });
    } else {
      await this.prisma.featureModule.update({
        where: { key: target.targetKey },
        data: {
          enabled: Boolean(target.previousState.enabled),
          version: String(target.previousState.version ?? '1.0.0'),
          settingsJson: (target.previousState.settingsJson ?? undefined) as object | undefined,
        },
      });
    }

    await this.adminService.logAction(
      actorId,
      'FEATURE_CONFIG_ROLLBACK',
      target.targetType,
      target.targetKey,
      `Rolled back ${target.targetKey} to snapshot ${target.id}`,
      ip,
      'FEATURE_CONFIG',
    );
    return { rolledBack: true, targetKey: target.targetKey, targetType: target.targetType };
  }

  // ============================================================================
  // F. BUSINESS MANAGEMENT
  // ============================================================================

  async listBusinessesFiltered(page: number, limit: number, status?: BusinessVerificationStatus) {
    const where = status ? { verificationStatus: status, deletedAt: null } : { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.businessProfile.findMany({
        where,
        include: {
          owner: { select: { id: true, email: true, displayName: true } },
          _count: { select: { products: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.businessProfile.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async verifyBusiness(actorId: string, businessId: string, dto: VerifyBusinessDto, ip?: string) {
    const biz = await this.prisma.businessProfile.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Business account not found');
    const nextStatus =
      dto.status === 'VERIFIED' ? BusinessVerificationStatus.VERIFIED : BusinessVerificationStatus.REJECTED;

    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: { verificationStatus: nextStatus },
    });
    await this.adminService.logAction(
      actorId,
      'BUSINESS_VERIFICATION_UPDATED',
      'BusinessProfile',
      businessId,
      `Business ${biz.businessName} -> ${nextStatus}${dto.notes ? ` (${dto.notes})` : ''}`,
      ip,
      'APPROVAL',
    );
    return updated;
  }

  async restrictBusiness(actorId: string, businessId: string, dto: RestrictBusinessDto, ip?: string) {
    const biz = await this.prisma.businessProfile.findUnique({ where: { id: businessId } });
    if (!biz) throw new NotFoundException('Business account not found');
    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        restricted: dto.restricted,
        restrictionReason: dto.restricted ? dto.reason?.trim() || 'Restricted by administrator' : null,
      },
    });
    await this.adminService.logAction(
      actorId,
      dto.restricted ? 'BUSINESS_RESTRICTED' : 'BUSINESS_UNRESTRICTED',
      'BusinessProfile',
      businessId,
      `Business ${biz.businessName} restricted=${dto.restricted}`,
      ip,
      'SECURITY_EVENT',
    );
    return updated;
  }

  async listBusinessCatalog(businessId: string) {
    return this.prisma.product.findMany({
      where: { businessId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async moderateBusinessProduct(
    actorId: string,
    businessId: string,
    productId: string,
    dto: ModerateProductDto,
    ip?: string,
  ) {
    const prod = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!prod) throw new NotFoundException('Catalog product not found');
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { inStock: dto.inStock },
    });
    await this.adminService.logAction(
      actorId,
      'CATALOG_PRODUCT_MODERATED',
      'Product',
      productId,
      `Product ${prod.sku} inStock=${dto.inStock}`,
      ip,
    );
    return updated;
  }

  // ============================================================================
  // G. CONTENT MODERATION
  // ============================================================================

  async listModerationReports(status?: string, targetType?: string) {
    const where: Record<string, unknown> = {};
    if (status && status !== 'ALL') where.status = status;
    if (targetType && targetType !== 'ALL') where.targetType = targetType;

    return this.prisma.abuseReport.findMany({
      where,
      include: {
        reporter: { select: { id: true, email: true, displayName: true } },
        targetUser: { select: { id: true, email: true, displayName: true, suspended: true, bannedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async decideModerationReport(actorId: string, reportId: string, dto: ModerationDecisionDto, ip?: string) {
    const report = await this.prisma.abuseReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Abuse report not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextStatus = dto.decision === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
      const rep = await tx.abuseReport.update({
        where: { id: reportId },
        data: {
          status: nextStatus,
          resolutionNotes: dto.notes?.trim() ?? dto.decision,
          resolvedById: actorId,
          resolvedAt: new Date(),
        },
      });
      if (dto.decision === 'SUSPEND_TARGET') {
        await tx.user.update({ where: { id: report.targetUserId }, data: { suspended: true } });
        await tx.deviceSession.updateMany({
          where: { userId: report.targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else if (dto.decision === 'BAN_TARGET') {
        await tx.user.update({
          where: { id: report.targetUserId },
          data: { suspended: true, bannedAt: new Date(), banReason: dto.notes ?? report.reason },
        });
        await tx.deviceSession.updateMany({
          where: { userId: report.targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return rep;
    });

    await this.adminService.logAction(
      actorId,
      `MODERATION_${dto.decision}`,
      'AbuseReport',
      reportId,
      `Decision=${dto.decision} on targetType=${report.targetType}`,
      ip,
      'SECURITY_EVENT',
    );
    return updated;
  }

  // ============================================================================
  // H. FINANCE
  // ============================================================================

  async getFinanceOverview() {
    const [plans, subscriptions, transactions, invoices, refunds, revenueAgg] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: { monthlyPriceCents: 'asc' } }),
      this.prisma.businessSubscription.findMany({
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          plan: { select: { code: true, name: true, monthlyPriceCents: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.paymentTransaction.findMany({
        include: { user: { select: { id: true, email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.invoice.findMany({
        include: { user: { select: { id: true, email: true, displayName: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 50,
      }),
      this.prisma.refundRequest.findMany({
        include: { transaction: { select: { id: true, amountCents: true, currency: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amountCents: true },
        _count: { id: true },
      }),
    ]);

    return {
      summary: {
        grossRevenueCents: revenueAgg._sum.amountCents ?? 0,
        successfulTransactions: revenueAgg._count.id,
        activeSubscriptions: subscriptions.filter((s) => s.status === 'ACTIVE').length,
        pendingRefunds: refunds.filter((r) => r.status === ApprovalStatus.PENDING).length,
      },
      plans,
      subscriptions,
      transactions,
      invoices,
      refunds,
    };
  }

  async upsertSubscriptionPlan(actorId: string, dto: UpsertSubscriptionPlanDto, ip?: string) {
    const plan = await this.prisma.subscriptionPlan.upsert({
      where: { code: dto.code },
      update: {
        name: dto.name.trim(),
        monthlyPriceCents: dto.monthlyPriceCents,
        currency: dto.currency ?? 'USD',
        featuresJson: dto.features,
        active: dto.active ?? true,
      },
      create: {
        code: dto.code,
        name: dto.name.trim(),
        monthlyPriceCents: dto.monthlyPriceCents,
        currency: dto.currency ?? 'USD',
        featuresJson: dto.features,
        active: dto.active ?? true,
      },
    });
    await this.adminService.logAction(
      actorId,
      'SUBSCRIPTION_PLAN_UPSERTED',
      'SubscriptionPlan',
      plan.id,
      `Plan ${plan.code} price=${plan.monthlyPriceCents}c`,
      ip,
    );
    return plan;
  }

  async createRefundApprovalWorkflow(actorId: string, dto: CreateRefundRequestDto, ip?: string) {
    const txRecord = await this.prisma.paymentTransaction.findUnique({ where: { id: dto.transactionId } });
    if (!txRecord) throw new NotFoundException('Transaction not found');

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refundRequest.create({
        data: {
          transactionId: txRecord.id,
          requestedById: actorId,
          reason: dto.reason.trim(),
          status: ApprovalStatus.PENDING,
        },
      });
      const approval = await tx.approvalWorkflow.create({
        data: {
          workflowType: 'REFUND',
          targetId: refund.id,
          requestedById: actorId,
          status: ApprovalStatus.PENDING,
          notes: dto.reason.trim(),
        },
      });
      return { refund, approval };
    });

    await this.adminService.logAction(
      actorId,
      'REFUND_REQUEST_CREATED',
      'RefundRequest',
      result.refund.id,
      `Queued refund approval for tx ${txRecord.id}`,
      ip,
      'APPROVAL',
    );
    return result;
  }

  // ============================================================================
  // I. NOTIFICATIONS & CAMPAIGNS
  // ============================================================================

  async listNotificationCenter() {
    const [announcements, templates, recentNotifications] = await Promise.all([
      this.prisma.systemAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      this.prisma.notificationTemplate.findMany({ orderBy: { templateKey: 'asc' } }),
      this.prisma.notificationRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    return { announcements, templates, recentNotifications };
  }

  async upsertNotificationTemplate(actorId: string, dto: UpsertNotificationTemplateDto, ip?: string) {
    const tpl = await this.prisma.notificationTemplate.upsert({
      where: { templateKey: dto.templateKey },
      update: {
        channel: dto.channel,
        subjectTemplate: dto.subjectTemplate,
        bodyTemplate: dto.bodyTemplate,
        locale: dto.locale ?? 'en',
      },
      create: {
        templateKey: dto.templateKey,
        channel: dto.channel,
        subjectTemplate: dto.subjectTemplate,
        bodyTemplate: dto.bodyTemplate,
        locale: dto.locale ?? 'en',
      },
    });
    await this.adminService.logAction(
      actorId,
      'NOTIFICATION_TEMPLATE_UPSERTED',
      'NotificationTemplate',
      tpl.id,
      `Saved template ${tpl.templateKey}`,
      ip,
    );
    return tpl;
  }

  async dispatchNotificationCampaign(actorId: string, dto: BroadcastCampaignDto, ip?: string) {
    const where: Record<string, unknown> = { deletedAt: null, suspended: false };
    if (dto.audience === 'ADMINS') {
      where.role = { not: 'MEMBER' };
    } else if (dto.audience === 'BUSINESS_OWNERS') {
      where.businessProfile = { isNot: null };
    }

    const recipients = await this.prisma.user.findMany({
      where,
      select: { id: true },
      take: 250,
    });

    for (const r of recipients) {
      await this.notifications.enqueueNotification({
        userId: r.id,
        channel: dto.channel,
        eventType: 'ADMIN_CAMPAIGN',
        title: dto.title.trim(),
        body: dto.body.trim(),
      });
    }

    await this.adminService.logAction(
      actorId,
      'NOTIFICATION_CAMPAIGN_SENT',
      'NotificationRecord',
      dto.audience ?? 'ALL',
      `Dispatched ${dto.channel} campaign "${dto.title}" to ${recipients.length} recipients`,
      ip,
    );
    return { queuedCount: recipients.length, channel: dto.channel };
  }

  // ============================================================================
  // J. ANALYTICS & EXPORT (CSV / JSON — Client also renders PDF)
  // ============================================================================

  async getAnalyticsReport() {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      return d.toISOString().slice(0, 10);
    });

    const [
      usersCount,
      messagesCount,
      businessesCount,
      subsByStatus,
      storageByOwner,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.message.count(),
      this.prisma.businessProfile.count({ where: { deletedAt: null } }),
      this.prisma.businessSubscription.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.mediaObject.aggregate({ _sum: { sizeBytes: true }, _count: { id: true } }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: { createdAt: true },
      }),
    ]);

    const growthSeries = last7Days.map((day) => ({
      date: day,
      newUsers: recentUsers.filter((u) => u.createdAt.toISOString().startsWith(day)).length,
    }));

    return {
      totals: {
        users: usersCount,
        messages: messagesCount,
        businesses: businessesCount,
        mediaObjects: storageByOwner._count.id,
        storageBytes: storageByOwner._sum.sizeBytes ?? 0,
      },
      subscriptions: subsByStatus,
      userGrowth7d: growthSeries,
    };
  }

  async exportAnalyticsCsv(actorId: string, ip?: string): Promise<string> {
    const report = await this.getAnalyticsReport();
    await this.adminService.logAction(
      actorId,
      'ANALYTICS_EXPORTED_CSV',
      'Analytics',
      'platform_report',
      'Exported deterministic CSV analytics snapshot',
      ip,
    );
    const lines = [
      'metric,value',
      `total_users,${report.totals.users}`,
      `total_messages_count_only,${report.totals.messages}`,
      `total_businesses,${report.totals.businesses}`,
      `media_objects,${report.totals.mediaObjects}`,
      `storage_bytes,${report.totals.storageBytes}`,
      '',
      'date,new_users',
      ...report.userGrowth7d.map((p) => `${p.date},${p.newUsers}`),
    ];
    return lines.join('\n');
  }

  // ============================================================================
  // K. SYSTEM SETTINGS
  // ============================================================================

  async getSystemSettings() {
    const configs = await this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    const map = new Map(configs.map((c) => [c.key, c.valueJson]));
    return {
      branding: map.get('branding') ?? {
        appName: 'ConnectX',
        logoUrl: '',
        appIconUrl: '',
        primaryColor: '#0D6E52',
        accentColor: '#10B981',
        splashHeadline: 'Enterprise Communication Platform',
      },
      localization: map.get('localization') ?? { defaultLanguage: 'en', supported: ['en', 'hi', 'as'] },
      privacy: map.get('privacy') ?? { e2eeRequiredForPrivateChats: true, defaultDisappearingSeconds: 0 },
      notifications: map.get('notifications') ?? { pushEnabled: true, emailAlertsEnabled: true },
      maintenanceMode: map.get('maintenance_mode') ?? { enabled: false, reason: null },
      rawConfigs: configs,
    };
  }

  async updateSystemSettings(actorId: string, dto: UpdateSystemSettingsDto, ip?: string) {
    const pairs: Array<[string, Record<string, unknown>]> = [];
    if (dto.branding) pairs.push(['branding', dto.branding]);
    if (dto.localization) pairs.push(['localization', dto.localization]);
    if (dto.privacy) pairs.push(['privacy', dto.privacy]);
    if (dto.notifications) pairs.push(['notifications', dto.notifications]);
    if (dto.maintenanceEnabled !== undefined) {
      pairs.push([
        'maintenance_mode',
        { enabled: dto.maintenanceEnabled, reason: dto.maintenanceReason ?? null },
      ]);
    }

    for (const [key, valueJson] of pairs) {
      await this.prisma.systemConfig.upsert({
        where: { key },
        update: { valueJson: valueJson as object, updatedById: actorId },
        create: { key, valueJson: valueJson as object, updatedById: actorId },
      });
    }

    await this.adminService.logAction(
      actorId,
      'SYSTEM_SETTINGS_UPDATED',
      'SystemConfig',
      pairs.map(([k]) => k).join(','),
      `Updated system settings (${pairs.map(([k]) => k).join(', ')})`,
      ip,
    );
    return this.getSystemSettings();
  }

  // ============================================================================
  // M. DEVELOPER CONTROL CENTER (Strictly Controlled Version/Release Registry)
  // ============================================================================

  async getDeveloperOverview() {
    const [modules, releases, pendingReleaseApprovals, pendingJobs, failedJobs, backups] = await Promise.all([
      this.prisma.featureModule.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.appRelease.findMany({ orderBy: { publishedAt: 'desc' }, take: 30 }),
      this.prisma.approvalWorkflow.findMany({
        where: { workflowType: 'PRODUCTION_RELEASE' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.notificationJob.count({ where: { status: 'QUEUED' } }),
      this.prisma.notificationJob.count({ where: { status: 'FAILED' } }),
      this.prisma.backupRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      modules,
      releases,
      releaseApprovals: pendingReleaseApprovals,
      jobs: {
        queuedNotificationJobs: pendingJobs,
        failedNotificationJobs: failedJobs,
        rabbitMqStatus: this.rabbitMq.status(),
      },
      apiHealth: {
        status: 'OPERATIONAL',
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      backups,
      controlledReleasePolicy: 'CODE_DEPLOYMENT_REQUIRED_NO_RUNTIME_EVAL',
    };
  }

  async createStagingRelease(actorId: string, dto: CreateReleaseDto, ip?: string) {
    const checksumSha256 = crypto
      .createHash('sha256')
      .update(`${dto.platform}:${dto.version}:${dto.buildNumber}:${dto.releaseNotes}`)
      .digest('hex');

    const release = await this.prisma.appRelease.create({
      data: {
        platform: dto.platform.trim().toUpperCase(),
        version: dto.version.trim(),
        buildNumber: dto.buildNumber,
        stage: 'STAGING',
        minSupported: dto.minSupported ?? true,
        releaseNotes: dto.releaseNotes.trim(),
        checksumSha256,
      },
    });
    await this.adminService.logAction(
      actorId,
      'STAGING_RELEASE_REGISTERED',
      'AppRelease',
      release.id,
      `Registered ${release.platform} v${release.version} (${release.buildNumber}) on STAGING`,
      ip,
      'DEVELOPER',
    );
    return release;
  }

  async requestProductionPromotion(actorId: string, releaseId: string, ip?: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) throw new NotFoundException('Release not found');
    if (release.stage === 'PRODUCTION') {
      throw new BadRequestException('Release is already in PRODUCTION stage');
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        workflowType: 'PRODUCTION_RELEASE',
        targetId: release.id,
        requestedById: actorId,
        status: ApprovalStatus.PENDING,
        notes: `Promote ${release.platform} v${release.version} (#${release.buildNumber}) to PRODUCTION`,
      },
    });
    await this.adminService.logAction(
      actorId,
      'PRODUCTION_PROMOTION_REQUESTED',
      'AppRelease',
      release.id,
      `Requested production approval for ${release.platform} v${release.version}`,
      ip,
      'APPROVAL',
    );
    return workflow;
  }

  async rollbackRelease(actorId: string, releaseId: string, ip?: string) {
    const release = await this.prisma.appRelease.findUnique({ where: { id: releaseId } });
    if (!release) throw new NotFoundException('Release not found');

    const updated = await this.prisma.appRelease.update({
      where: { id: releaseId },
      data: { stage: 'ROLLED_BACK', minSupported: false },
    });
    await this.adminService.logAction(
      actorId,
      'RELEASE_ROLLED_BACK',
      'AppRelease',
      release.id,
      `Rolled back ${release.platform} v${release.version}`,
      ip,
      'SECURITY_EVENT',
    );
    return updated;
  }
}
