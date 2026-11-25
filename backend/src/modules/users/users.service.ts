import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PresenceStatus } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { saveValidatedUpload } from '../../common/upload/upload-security';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.module';
import {
  AddContactDto,
  BlockUserDto,
  RegisterKeyBundleDto,
  ReportUserDto,
  UpdatePresenceDto,
  UpdatePrivacyDto,
  UpdateProfileDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        department: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
        presenceStatus: true,
        lastSeenAt: true,
        showLastSeen: true,
        showProfilePhoto: true,
        readReceiptsEnabled: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const normalized = dto.username.trim().toLowerCase();
      const conflict = await this.prisma.user.findFirst({
        where: { username: normalized, id: { not: userId } },
      });
      if (conflict) throw new ConflictException('Username is already taken');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.username ? { username: dto.username.trim().toLowerCase() } : {}),
        ...(dto.department ? { department: dto.department.trim() } : {}),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        department: true,
        avatarUrl: true,
      },
    });
  }

  async uploadAvatar(userId: string, file: { mimetype: string; size: number; buffer: Buffer }) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Avatar must be an image');
    }
    const saved = await saveValidatedUpload(file);
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: saved.url },
      select: { id: true, avatarUrl: true },
    });
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        showLastSeen: true,
        showProfilePhoto: true,
        readReceiptsEnabled: true,
      },
    });
  }

  async updatePresence(userId: string, dto: UpdatePresenceDto) {
    const now = new Date();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { presenceStatus: dto.presenceStatus, lastSeenAt: now },
      select: { id: true, presenceStatus: true, lastSeenAt: true },
    });
    if (dto.presenceStatus === PresenceStatus.OFFLINE) {
      this.realtime.server?.emit('user:offline', { userId, lastSeenAt: now.toISOString() });
    } else {
      this.realtime.server?.emit('user:online', { userId, status: dto.presenceStatus });
    }
    return updated;
  }

  async getPublicProfile(viewerId: string, targetUserId: string) {
    const blocked = await this.prisma.userBlock.findFirst({
      where: { blockerId: targetUserId, blockedId: viewerId },
    });
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        displayName: true,
        department: true,
        avatarUrl: true,
        presenceStatus: true,
        lastSeenAt: true,
        showLastSeen: true,
        showProfilePhoto: true,
      },
    });
    if (!target) throw new NotFoundException('User not found');

    return {
      id: target.id,
      username: target.username,
      displayName: target.displayName,
      department: target.department,
      avatarUrl: !blocked && target.showProfilePhoto ? target.avatarUrl : null,
      presenceStatus: !blocked && target.showLastSeen ? target.presenceStatus : PresenceStatus.OFFLINE,
      lastSeenAt: !blocked && target.showLastSeen ? target.lastSeenAt : null,
    };
  }

  async registerKeyBundle(userId: string, dto: RegisterKeyBundleDto) {
    return this.prisma.userKeyBundle.upsert({
      where: { userId_deviceId: { userId, deviceId: dto.deviceId } },
      update: {
        identityPublicKey: dto.identityPublicKey,
        signedPreKey: dto.signedPreKey,
        signedPreKeySignature: dto.signedPreKeySignature,
        oneTimePreKeysJson: dto.oneTimePreKeys,
        keyVersion: dto.keyVersion ?? 1,
      },
      create: {
        userId,
        deviceId: dto.deviceId,
        identityPublicKey: dto.identityPublicKey,
        signedPreKey: dto.signedPreKey,
        signedPreKeySignature: dto.signedPreKeySignature,
        oneTimePreKeysJson: dto.oneTimePreKeys,
        keyVersion: dto.keyVersion ?? 1,
      },
    });
  }

  async getKeyBundles(targetUserId: string) {
    return this.prisma.userKeyBundle.findMany({
      where: { userId: targetUserId },
      select: {
        deviceId: true,
        identityPublicKey: true,
        signedPreKey: true,
        signedPreKeySignature: true,
        oneTimePreKeysJson: true,
        keyVersion: true,
        updatedAt: true,
      },
    });
  }

  async addContact(ownerId: string, dto: AddContactDto) {
    if (ownerId === dto.contactUserId) {
      throw new BadRequestException('Cannot add yourself as a contact');
    }
    const target = await this.prisma.user.findUnique({ where: { id: dto.contactUserId } });
    if (!target) throw new NotFoundException('Target user does not exist');

    return this.prisma.contact.upsert({
      where: { ownerId_contactUserId: { ownerId, contactUserId: dto.contactUserId } },
      update: { nickname: dto.nickname?.trim() ?? null },
      create: { ownerId, contactUserId: dto.contactUserId, nickname: dto.nickname?.trim() ?? null },
    });
  }

  async listContacts(ownerId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where: { ownerId },
        include: {
          contactUser: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, presenceStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.contact.count({ where: { ownerId } }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async removeContact(ownerId: string, contactId: string) {
    await this.prisma.contact.deleteMany({ where: { id: contactId, ownerId } });
    return { removed: true };
  }

  async blockUser(blockerId: string, dto: BlockUserDto) {
    if (blockerId === dto.blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }
    return this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId: dto.blockedId } },
      update: { reason: dto.reason ?? null },
      create: { blockerId, blockedId: dto.blockedId, reason: dto.reason ?? null },
    });
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { unblocked: true };
  }

  async listBlocked(blockerId: string) {
    return this.prisma.userBlock.findMany({
      where: { blockerId },
      include: { blocked: { select: { id: true, username: true, displayName: true } } },
    });
  }

  async reportUser(reporterId: string, dto: ReportUserDto) {
    return this.prisma.abuseReport.create({
      data: {
        reporterId,
        targetUserId: dto.targetUserId,
        reason: dto.reason.trim(),
      },
    });
  }
}
