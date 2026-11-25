import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationDeliveryStatus } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import * as webpush from 'web-push';
import { loadConfig } from '../../config/env.config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NOTIFICATIONS, RabbitMqService } from '../../rabbitmq/rabbitmq.module';
import { RealtimeGateway } from '../../realtime/realtime.module';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import {
  RegisterPushSubscriptionDto,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly cfg = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly realtime: RealtimeGateway,
  ) {
    if (this.cfg.vapidSubject && this.cfg.vapidPublicKey && this.cfg.vapidPrivateKey) {
      webpush.setVapidDetails(
        this.cfg.vapidSubject,
        this.cfg.vapidPublicKey,
        this.cfg.vapidPrivateKey,
      );
    }
  }

  async onModuleInit(): Promise<void> {
    await this.rabbitMq.consume(QUEUE_NOTIFICATIONS, async (payload) => {
      const recordId = payload.notificationId as string | undefined;
      if (!recordId) return;
      await this.processQueuedNotification(recordId);
    });
  }

  isSmtpConfigured(): boolean {
    return Boolean(this.cfg.smtpHost && this.cfg.smtpUser && this.cfg.smtpPass && this.cfg.smtpFrom);
  }

  isPushConfigured(): boolean {
    return Boolean(this.cfg.vapidSubject && this.cfg.vapidPublicKey && this.cfg.vapidPrivateKey);
  }

  async enqueueNotification(params: {
    userId: string;
    channel: NotificationChannel;
    eventType: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId: params.userId },
    });

    if (params.eventType === 'MESSAGE' && prefs && !prefs.messageAlerts) return null;
    if (params.eventType === 'CALL' && prefs && !prefs.callAlerts) return null;
    if (params.eventType === 'GROUP' && prefs && !prefs.groupAlerts) return null;

    const record = await this.prisma.notificationRecord.create({
      data: {
        userId: params.userId,
        channel: params.channel,
        eventType: params.eventType,
        title: params.title,
        body: params.body,
        metadataJson: (params.metadata ?? {}) as object,
        deliveryStatus: NotificationDeliveryStatus.QUEUED,
      },
    });

    this.realtime.emitToUser(params.userId, 'notification:new', {
      id: record.id,
      eventType: record.eventType,
      title: record.title,
      body: record.body,
      createdAt: record.createdAt,
    });

    const published = await this.rabbitMq.publish(QUEUE_NOTIFICATIONS, {
      notificationId: record.id,
    });
    if (!published) {
      return this.processQueuedNotification(record.id);
    }
    return record;
  }

  async processQueuedNotification(notificationId: string) {
    const record = await this.prisma.notificationRecord.findUnique({
      where: { id: notificationId },
      include: { user: true },
    });
    if (!record) return null;

    let finalStatus: NotificationDeliveryStatus = NotificationDeliveryStatus.SENT;

    if (record.channel === NotificationChannel.EMAIL) {
      if (!this.isSmtpConfigured()) {
        finalStatus = NotificationDeliveryStatus.UNCONFIGURED;
      } else {
        try {
          const transporter = nodemailer.createTransport({
            host: this.cfg.smtpHost,
            port: this.cfg.smtpPort,
            secure: this.cfg.smtpPort === 465,
            auth: { user: this.cfg.smtpUser, pass: this.cfg.smtpPass },
          });
          await transporter.sendMail({
            from: this.cfg.smtpFrom,
            to: record.user.email,
            subject: record.title,
            text: record.body,
          });
          finalStatus = NotificationDeliveryStatus.SENT;
        } catch (err) {
          this.logger.warn(`SMTP dispatch failed: ${(err as Error).message}`);
          finalStatus = NotificationDeliveryStatus.FAILED;
        }
      }
    } else if (record.channel === NotificationChannel.PUSH) {
      if (!this.isPushConfigured()) {
        finalStatus = NotificationDeliveryStatus.UNCONFIGURED;
      } else {
        const subs = await this.prisma.pushSubscription.findMany({
          where: { userId: record.userId },
        });
        if (subs.length === 0) {
          finalStatus = NotificationDeliveryStatus.FAILED;
        } else {
          let anySent = false;
          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify({ title: record.title, body: record.body, eventType: record.eventType }),
              );
              anySent = true;
            } catch (err) {
              this.logger.warn(`Push dispatch error: ${(err as Error).message}`);
            }
          }
          finalStatus = anySent ? NotificationDeliveryStatus.SENT : NotificationDeliveryStatus.FAILED;
        }
      }
    }

    return this.prisma.notificationRecord.update({
      where: { id: record.id },
      data: { deliveryStatus: finalStatus },
    });
  }

  async listNotifications(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notificationRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationRecord.count({ where: { userId } }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notificationRecord.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    return { markedRead: true };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
  }

  async registerPushSubscription(userId: string, dto: RegisterPushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId, p256dh: dto.p256dh, auth: dto.auth },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    });
  }

  integrationStatus() {
    return {
      smtpConfigured: this.isSmtpConfigured(),
      webPushConfigured: this.isPushConfigured(),
      queueStatus: this.rabbitMq.status(),
    };
  }
}
