import { Global, Logger, Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { PresenceStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { loadConfig } from '../config/env.config';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: loadConfig().corsOrigins,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly accessSecret = loadConfig().jwtAccessSecret;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync<{ sub: string; sid: string }>(token, {
        secret: this.accessSecret,
      });
      const session = await this.prisma.deviceSession.findUnique({ where: { id: payload.sid } });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      await client.join(`user:${payload.sub}`);

      const memberships = await this.prisma.conversationMember.findMany({
        where: { userId: payload.sub },
        select: { conversationId: true },
      });
      for (const m of memberships) {
        await client.join(`conversation:${m.conversationId}`);
      }

      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { presenceStatus: PresenceStatus.ONLINE, lastSeenAt: new Date() },
      });
      this.server.emit('user:online', { userId: payload.sub, timestamp: new Date().toISOString() });
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const now = new Date();
    await this.prisma.user
      .update({
        where: { id: userId },
        data: { presenceStatus: PresenceStatus.OFFLINE, lastSeenAt: now },
      })
      .catch(() => undefined);
    this.server.emit('user:offline', { userId, lastSeenAt: now.toISOString() });
  }

  @SubscribeMessage('user:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; isTyping: boolean },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.conversationId) throw new WsException('Unauthorized or missing conversationId');
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: body.conversationId, userId } },
    });
    if (!member) throw new WsException('Not a conversation participant');
    client.to(`conversation:${body.conversationId}`).emit('user:typing', {
      conversationId: body.conversationId,
      userId,
      isTyping: Boolean(body.isTyping),
    });
  }

  @SubscribeMessage('message:send')
  async handleClientMessageSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; clientMessageId?: string },
  ): Promise<{ acknowledged: boolean }> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.conversationId) throw new WsException('Unauthorized');
    await client.join(`conversation:${body.conversationId}`);
    return { acknowledged: true };
  }

  @SubscribeMessage('call:signal')
  async handleWebRtcSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: { callId: string; targetUserId: string; signalType: 'offer' | 'answer' | 'ice'; payload: unknown },
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId || !body?.callId || !body?.targetUserId) throw new WsException('Invalid signaling payload');
    const participant = await this.prisma.callParticipant.findUnique({
      where: { callId_userId: { callId: body.callId, userId } },
    });
    if (!participant) throw new WsException('Not a participant in this call');
    this.server.to(`user:${body.targetUserId}`).emit('call:signal', {
      callId: body.callId,
      fromUserId: userId,
      signalType: body.signalType,
      payload: body.payload,
    });
  }

  emitToConversation(conversationId: string, event: string, data: unknown): void {
    this.server?.to(`conversation:${conversationId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
}

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
