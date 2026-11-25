import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallParticipantStatus, CallStatus, NotificationChannel } from '@prisma/client';
import * as crypto from 'crypto';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { loadConfig } from '../../config/env.config';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.module';
import { NotificationsService } from '../notifications/notifications.service';
import { InitiateCallDto } from './dto/calling.dto';

@Injectable()
export class CallingService {
  private readonly cfg = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  getIceServers(userId: string) {
    const iceServers: Array<{ urls: string; username?: string; credential?: string }> = [
      { urls: this.cfg.stunUrl },
    ];

    const turnConfigured = Boolean(this.cfg.turnUrl && this.cfg.turnSecret);
    if (turnConfigured) {
      const expiry = Math.floor(Date.now() / 1000) + this.cfg.turnCredentialTtlSec;
      const username = `${expiry}:${userId}`;
      const credential = crypto
        .createHmac('sha1', this.cfg.turnSecret)
        .update(username)
        .digest('base64');
      iceServers.push({
        urls: this.cfg.turnUrl,
        username,
        credential,
      });
    }

    return {
      turnConfigured,
      iceServers,
    };
  }

  async initiateCall(initiatorId: string, dto: InitiateCallDto) {
    const invitees = Array.from(new Set(dto.inviteeIds.filter((id) => id !== initiatorId)));
    if (invitees.length === 0) {
      throw new BadRequestException('At least one callee must be invited');
    }

    const session = await this.prisma.callSession.create({
      data: {
        conversationId: dto.conversationId ?? null,
        initiatorId,
        callType: dto.callType,
        status: CallStatus.RINGING,
        participants: {
          create: [
            { userId: initiatorId, status: CallParticipantStatus.JOINED, joinedAt: new Date() },
            ...invitees.map((uid) => ({ userId: uid, status: CallParticipantStatus.INVITED })),
          ],
        },
      },
      include: { participants: true },
    });

    for (const calleeId of invitees) {
      this.realtime.emitToUser(calleeId, 'call:incoming', {
        callId: session.id,
        callType: session.callType,
        initiatorId,
        conversationId: session.conversationId,
      });
      await this.notifications.enqueueNotification({
        userId: calleeId,
        channel: NotificationChannel.IN_APP,
        eventType: 'CALL',
        title: `Incoming ${session.callType} Call`,
        body: 'You have an incoming ConnectX call',
        metadata: { callId: session.id, callType: session.callType },
      });
    }

    return session;
  }

  async acceptCall(userId: string, callId: string) {
    const participant = await this.prisma.callParticipant.findUnique({
      where: { callId_userId: { callId, userId } },
      include: { call: { include: { participants: true } } },
    });
    if (!participant) throw new ForbiddenException('Not invited to this call');
    if (participant.call.status === CallStatus.ENDED || participant.call.status === CallStatus.DECLINED) {
      throw new BadRequestException('Call has already ended');
    }

    const now = new Date();
    const updatedCall = await this.prisma.$transaction(async (tx) => {
      await tx.callParticipant.update({
        where: { id: participant.id },
        data: { status: CallParticipantStatus.JOINED, joinedAt: now },
      });
      return tx.callSession.update({
        where: { id: callId },
        data: {
          status: CallStatus.ACTIVE,
          startedAt: participant.call.startedAt ?? now,
        },
        include: { participants: true },
      });
    });

    for (const p of updatedCall.participants) {
      this.realtime.emitToUser(p.userId, 'call:accepted', {
        callId,
        acceptedBy: userId,
        startedAt: updatedCall.startedAt,
      });
    }
    return updatedCall;
  }

  async endCall(userId: string, callId: string) {
    const call = await this.prisma.callSession.findUnique({
      where: { id: callId },
      include: { participants: true },
    });
    if (!call) throw new NotFoundException('Call session not found');
    if (!call.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Not a participant in this call');
    }

    const now = new Date();
    const durationSeconds = call.startedAt
      ? Math.max(0, Math.floor((now.getTime() - call.startedAt.getTime()) / 1000))
      : 0;
    const nextStatus = call.status === CallStatus.RINGING ? CallStatus.MISSED : CallStatus.ENDED;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.callParticipant.updateMany({
        where: { callId, leftAt: null },
        data: { status: CallParticipantStatus.LEFT, leftAt: now },
      });
      return tx.callSession.update({
        where: { id: callId },
        data: { status: nextStatus, endedAt: now, durationSeconds },
        include: { participants: true },
      });
    });

    for (const p of updated.participants) {
      this.realtime.emitToUser(p.userId, 'call:ended', {
        callId,
        endedBy: userId,
        status: updated.status,
        durationSeconds,
      });
    }
    return updated;
  }

  async listHistory(userId: string, page: number, limit: number) {
    const where = { participants: { some: { userId } } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.callSession.findMany({
        where,
        include: { participants: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.callSession.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }
}
