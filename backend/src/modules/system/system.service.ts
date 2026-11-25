import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMqService } from '../../rabbitmq/rabbitmq.module';
import { RedisService } from '../../redis/redis.module';
import {
  CreateSystemAnnouncementDto,
  ToggleMaintenanceDto,
  UpsertConfigDto,
  UpsertFeatureFlagDto,
} from './dto/system.dto';

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  async getHealth() {
    let dbStatus: 'CONNECTED' | 'ERROR' = 'CONNECTED';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'ERROR';
    }

    const redisStatus = await this.redis.ping();
    const rabbitStatus = this.rabbitMq.status();
    const maintenance = await this.prisma.systemConfig.findUnique({
      where: { key: 'maintenance_mode' },
    });

    return {
      status: dbStatus === 'CONNECTED' ? 'OK' : 'DEGRADED',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        postgresql: dbStatus,
        redis: redisStatus,
        rabbitmq: rabbitStatus,
      },
      maintenanceMode: Boolean((maintenance?.valueJson as { enabled?: boolean } | null)?.enabled),
    };
  }

  upsertConfig(actorId: string, dto: UpsertConfigDto) {
    return this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      update: { valueJson: dto.value as object, updatedById: actorId },
      create: { key: dto.key, valueJson: dto.value as object, updatedById: actorId },
    });
  }

  listConfigs() {
    return this.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  }

  setMaintenanceMode(actorId: string, dto: ToggleMaintenanceDto) {
    return this.prisma.systemConfig.upsert({
      where: { key: 'maintenance_mode' },
      update: {
        valueJson: { enabled: dto.enabled, reason: dto.reason ?? null },
        updatedById: actorId,
      },
      create: {
        key: 'maintenance_mode',
        valueJson: { enabled: dto.enabled, reason: dto.reason ?? null },
        updatedById: actorId,
      },
    });
  }

  upsertFeatureFlag(actorId: string, dto: UpsertFeatureFlagDto) {
    return this.prisma.featureFlag.upsert({
      where: { key: dto.key },
      update: {
        enabled: dto.enabled,
        description: dto.description ?? null,
        rolloutPercent: dto.rolloutPercent ?? 100,
        updatedById: actorId,
      },
      create: {
        key: dto.key,
        enabled: dto.enabled,
        description: dto.description ?? null,
        rolloutPercent: dto.rolloutPercent ?? 100,
        updatedById: actorId,
      },
    });
  }

  listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  createAnnouncement(actorId: string, dto: CreateSystemAnnouncementDto) {
    return this.prisma.systemAnnouncement.create({
      data: {
        title: dto.title.trim(),
        body: dto.body.trim(),
        severity: dto.severity ?? 'INFO',
        authorId: actorId,
      },
    });
  }

  listAnnouncements() {
    return this.prisma.systemAnnouncement.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBackupManifest(actorId: string) {
    const [usersCount, convCount, ordersCount] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.conversation.count(),
      this.prisma.orderInquiry.count(),
    ]);
    const manifest = JSON.stringify({
      generatedAt: new Date().toISOString(),
      usersCount,
      conversationsCount: convCount,
      ordersCount,
    });
    const checksumSha256 = crypto.createHash('sha256').update(manifest).digest('hex');

    return this.prisma.backupRecord.create({
      data: {
        backupType: 'METADATA_MANIFEST',
        status: 'COMPLETED',
        checksumSha256,
        sizeBytes: Buffer.byteLength(manifest),
        triggeredById: actorId,
      },
    });
  }

  listBackups() {
    return this.prisma.backupRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async getSystemLogsSummary() {
    const recentAudits = await this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return {
      nodeVersion: process.version,
      memoryUsageBytes: process.memoryUsage(),
      recentAuditEvents: recentAudits,
    };
  }
}
