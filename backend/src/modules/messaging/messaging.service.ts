import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ConversationMemberRole,
  ConversationType,
  DeliveryStatus,
  NotificationChannel,
} from '@prisma/client';
import * as fs from 'fs';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { resolveSafeUploadPath, saveValidatedUpload } from '../../common/upload/upload-security';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_MESSAGE_DELIVERY, RabbitMqService } from '../../rabbitmq/rabbitmq.module';
import { RealtimeGateway } from '../../realtime/realtime.module';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateConversationDto,
  DisappearingSettingsDto,
  EditMessageDto,
  ReactMessageDto,
  SendMessageDto,
} from './dto/messaging.dto';

@Injectable()
export class MessagingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMq.consume(QUEUE_MESSAGE_DELIVERY, async (payload, attempts) => {
      const messageId = payload.messageId as string | undefined;
      if (!messageId) return;
      await this.processReliableDelivery(messageId, attempts + 1);
    });
  }

  private async ensureParticipant(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: { conversation: { include: { group: true } } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }
    return member;
  }

  async createConversation(creatorId: string, dto: CreateConversationDto) {
    const uniqueMemberIds = Array.from(new Set([creatorId, ...dto.memberIds]));
    if (dto.type === ConversationType.PRIVATE && uniqueMemberIds.length !== 2) {
      throw new BadRequestException('Private conversations require exactly two distinct participants');
    }

    if (dto.type === ConversationType.PRIVATE) {
      const otherId = uniqueMemberIds.find((id) => id !== creatorId)!;
      const blocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: creatorId, blockedId: otherId },
            { blockerId: otherId, blockedId: creatorId },
          ],
        },
      });
      if (blocked) throw new ForbiddenException('Messaging blocked between users');
    }

    const isEncrypted = dto.type === ConversationType.PRIVATE ? true : (dto.isEncrypted ?? true);

    return this.prisma.conversation.create({
      data: {
        type: dto.type,
        title: dto.title?.trim() ?? null,
        isEncrypted,
        disappearingTtlSeconds: dto.disappearingTtlSeconds ?? 0,
        createdById: creatorId,
        members: {
          create: uniqueMemberIds.map((uid) => ({
            userId: uid,
            role: uid === creatorId ? ConversationMemberRole.OWNER : ConversationMemberRole.MEMBER,
          })),
        },
      },
      include: { members: true },
    });
  }

  async listConversations(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({
        where: { members: { some: { userId } } },
        include: {
          members: {
            include: {
              user: { select: { id: true, username: true, displayName: true, avatarUrl: true, presenceStatus: true } },
            },
          },
          group: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.conversation.count({ where: { members: { some: { userId } } } }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const membership = await this.ensureParticipant(dto.conversationId, senderId);
    const conv = membership.conversation;

    if (
      conv.group?.announcementsOnly &&
      membership.role === ConversationMemberRole.MEMBER
    ) {
      throw new ForbiddenException('Only group admins may send messages in announcement-only mode');
    }

    if (conv.isEncrypted) {
      if (!dto.ciphertext || !dto.nonce) {
        throw new BadRequestException('Encrypted conversations require ciphertext and nonce; plaintext is disallowed');
      }
      if (dto.plaintextBody) {
        throw new BadRequestException('Plaintext body is forbidden on end-to-end encrypted conversations');
      }
    } else if (!dto.plaintextBody && !dto.mediaUrl) {
      throw new BadRequestException('Message requires plaintextBody or media attachment');
    }

    if (dto.forwardedFromId) {
      const source = await this.prisma.message.findUnique({ where: { id: dto.forwardedFromId } });
      if (!source) throw new NotFoundException('Source forwarded message not found');
    }

    const expiresAt =
      conv.disappearingTtlSeconds > 0
        ? new Date(Date.now() + conv.disappearingTtlSeconds * 1000)
        : null;

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId: conv.id,
          senderId,
          messageType: dto.messageType,
          isEncrypted: conv.isEncrypted,
          plaintextBody: conv.isEncrypted ? null : (dto.plaintextBody ?? null),
          ciphertext: conv.isEncrypted ? (dto.ciphertext ?? null) : null,
          nonce: conv.isEncrypted ? (dto.nonce ?? null) : null,
          senderKeyVersion: conv.isEncrypted ? (dto.senderKeyVersion ?? 1) : null,
          mediaUrl: dto.mediaUrl ?? null,
          mediaMimeType: dto.mediaMimeType ?? null,
          mediaSizeBytes: dto.mediaSizeBytes ?? null,
          replyToId: dto.replyToId ?? null,
          forwardedFromId: dto.forwardedFromId ?? null,
          expiresAt,
          deliveryStatus: DeliveryStatus.QUEUED,
        },
      });
      await tx.conversation.update({
        where: { id: conv.id },
        data: { updatedAt: new Date() },
      });
      return created;
    });

    const queued = await this.rabbitMq.publish(QUEUE_MESSAGE_DELIVERY, {
      messageId: message.id,
    });
    if (!queued) {
      return this.processReliableDelivery(message.id, 1);
    }
    return message;
  }

  async processReliableDelivery(messageId: string, attempt: number) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { members: true } } },
    });
    if (!msg) return null;

    const updated = await this.prisma.message.update({
      where: { id: msg.id },
      data: {
        deliveryAttempts: attempt,
        deliveryStatus: DeliveryStatus.SENT,
      },
    });

    this.realtime.emitToConversation(msg.conversationId, 'message:received', updated);

    for (const member of msg.conversation.members) {
      if (member.userId !== msg.senderId) {
        await this.notifications.enqueueNotification({
          userId: member.userId,
          channel: NotificationChannel.IN_APP,
          eventType: 'MESSAGE',
          title: 'New Message',
          body: msg.isEncrypted ? 'Encrypted message received' : (msg.plaintextBody?.slice(0, 120) || 'Media attachment'),
          metadata: { conversationId: msg.conversationId, messageId: msg.id },
        });
      }
    }

    return updated;
  }

  async listMessages(userId: string, conversationId: string, page: number, limit: number) {
    await this.ensureParticipant(conversationId, userId);
    const now = new Date();
    const where = {
      conversationId,
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where,
        include: { reactions: true, receipts: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.message.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async searchMessages(userId: string, conversationId: string, queryText: string) {
    const member = await this.ensureParticipant(conversationId, userId);
    if (member.conversation.isEncrypted) {
      throw new BadRequestException('Server-side text search is disabled for E2EE conversations; search locally on client');
    }
    return this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        plaintextBody: { contains: queryText, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async editMessage(userId: string, messageId: string, dto: EditMessageDto) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.deletedAt) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Only sender can edit message');

    if (msg.isEncrypted && (!dto.ciphertext || !dto.nonce)) {
      throw new BadRequestException('Encrypted edit requires ciphertext and nonce');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        plaintextBody: msg.isEncrypted ? null : (dto.plaintextBody ?? msg.plaintextBody),
        ciphertext: msg.isEncrypted ? dto.ciphertext : null,
        nonce: msg.isEncrypted ? dto.nonce : null,
        editedAt: new Date(),
      },
    });
    this.realtime.emitToConversation(msg.conversationId, 'message:edited', updated);
    return updated;
  }

  async deleteMessage(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    const membership = await this.ensureParticipant(msg.conversationId, userId);
    if (msg.senderId !== userId && membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only sender or conversation admin can delete this message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        plaintextBody: null,
        ciphertext: null,
        nonce: null,
        deletedAt: new Date(),
      },
    });
    this.realtime.emitToConversation(msg.conversationId, 'message:deleted', {
      id: msg.id,
      conversationId: msg.conversationId,
      deletedAt: updated.deletedAt,
    });
    return { deleted: true, id: msg.id };
  }

  async toggleReaction(userId: string, messageId: string, dto: ReactMessageDto) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.ensureParticipant(msg.conversationId, userId);

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji: dto.emoji } },
    });
    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
      return { reacted: false, emoji: dto.emoji };
    }
    const created = await this.prisma.messageReaction.create({
      data: { messageId, userId, emoji: dto.emoji },
    });
    return { reacted: true, reaction: created };
  }

  async markDelivered(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.ensureParticipant(msg.conversationId, userId);

    const receipt = await this.prisma.messageReceipt.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { deliveredAt: new Date() },
      create: { messageId, userId, deliveredAt: new Date() },
    });
    await this.prisma.message.update({
      where: { id: messageId },
      data: { deliveryStatus: DeliveryStatus.DELIVERED },
    });
    this.realtime.emitToConversation(msg.conversationId, 'message:delivered', {
      messageId,
      userId,
      deliveredAt: receipt.deliveredAt,
    });
    return receipt;
  }

  async markRead(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.ensureParticipant(msg.conversationId, userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const now = new Date();
    const receipt = await this.prisma.messageReceipt.upsert({
      where: { messageId_userId: { messageId, userId } },
      update: { deliveredAt: now, readAt: user?.readReceiptsEnabled ? now : null },
      create: { messageId, userId, deliveredAt: now, readAt: user?.readReceiptsEnabled ? now : null },
    });

    if (user?.readReceiptsEnabled) {
      await this.prisma.message.update({
        where: { id: messageId },
        data: { deliveryStatus: DeliveryStatus.READ },
      });
      this.realtime.emitToConversation(msg.conversationId, 'message:read', {
        messageId,
        userId,
        readAt: receipt.readAt,
      });
    }
    return receipt;
  }

  async togglePin(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.ensureParticipant(msg.conversationId, userId);
    return this.prisma.message.update({
      where: { id: messageId },
      data: { pinned: !msg.pinned },
    });
  }

  async toggleStar(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    await this.ensureParticipant(msg.conversationId, userId);

    const existing = await this.prisma.starredMessage.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });
    if (existing) {
      await this.prisma.starredMessage.delete({ where: { id: existing.id } });
      return { starred: false };
    }
    await this.prisma.starredMessage.create({ data: { messageId, userId } });
    return { starred: true };
  }

  async listStarred(userId: string) {
    return this.prisma.starredMessage.findMany({
      where: { userId },
      include: { message: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setDisappearingMessages(userId: string, conversationId: string, dto: DisappearingSettingsDto) {
    await this.ensureParticipant(conversationId, userId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { disappearingTtlSeconds: dto.ttlSeconds },
    });
  }

  async uploadMedia(userId: string, file: { mimetype: string; size: number; buffer: Buffer }) {
    if (!userId) throw new ForbiddenException();
    return saveValidatedUpload(file);
  }

  streamValidatedFile(fileName: string) {
    const resolved = resolveSafeUploadPath(fileName);
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException('File not found');
    }
    return resolved;
  }
}
