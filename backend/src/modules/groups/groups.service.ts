import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversationMemberRole,
  ConversationType,
  MessageType,
  NotificationChannel,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../../realtime/realtime.module';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AddGroupMemberDto,
  CreateGroupDto,
  GroupAnnouncementDto,
  UpdateGroupPermissionsDto,
} from './dto/groups.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async requireGroupMember(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: { conversation: { include: { members: true } } },
    });
    if (!group) throw new NotFoundException('Group not found');
    const membership = group.conversation.members.find((m) => m.userId === userId);
    if (!membership) throw new ForbiddenException('Not a member of this group');
    return { group, membership };
  }

  async createGroup(creatorId: string, dto: CreateGroupDto) {
    const members = Array.from(new Set([creatorId, ...(dto.memberIds ?? [])]));
    const inviteCode = crypto.randomBytes(8).toString('hex');

    return this.prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          type: ConversationType.GROUP,
          title: dto.name.trim(),
          isEncrypted: false,
          createdById: creatorId,
          members: {
            create: members.map((uid) => ({
              userId: uid,
              role: uid === creatorId ? ConversationMemberRole.OWNER : ConversationMemberRole.MEMBER,
            })),
          },
        },
      });

      const group = await tx.group.create({
        data: {
          conversationId: conv.id,
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          inviteCode,
          announcementsOnly: dto.announcementsOnly ?? false,
          createdById: creatorId,
        },
        include: { conversation: { include: { members: true } } },
      });
      return group;
    });
  }

  async getGroup(userId: string, groupId: string) {
    const { group } = await this.requireGroupMember(groupId, userId);
    return group;
  }

  async addMember(actorId: string, groupId: string, dto: AddGroupMemberDto) {
    const { group, membership } = await this.requireGroupMember(groupId, actorId);
    if (group.onlyAdminsCanInvite && membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can add members');
    }

    return this.prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: group.conversationId, userId: dto.userId },
      },
      update: { role: dto.role ?? ConversationMemberRole.MEMBER },
      create: {
        conversationId: group.conversationId,
        userId: dto.userId,
        role: dto.role ?? ConversationMemberRole.MEMBER,
      },
    });
  }

  async removeMember(actorId: string, groupId: string, targetUserId: string) {
    const { group, membership } = await this.requireGroupMember(groupId, actorId);
    if (actorId !== targetUserId && membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can remove other members');
    }
    await this.prisma.conversationMember.deleteMany({
      where: { conversationId: group.conversationId, userId: targetUserId },
    });
    return { removed: true };
  }

  async updateMemberRole(
    actorId: string,
    groupId: string,
    targetUserId: string,
    role: ConversationMemberRole,
  ) {
    const { group, membership } = await this.requireGroupMember(groupId, actorId);
    if (membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can manage group admin roles');
    }
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: group.conversationId, userId: targetUserId },
      },
      data: { role },
    });
  }

  async updatePermissions(actorId: string, groupId: string, dto: UpdateGroupPermissionsDto) {
    const { membership } = await this.requireGroupMember(groupId, actorId);
    if (membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can update group permissions');
    }
    return this.prisma.group.update({ where: { id: groupId }, data: dto });
  }

  async rotateInviteLink(actorId: string, groupId: string) {
    const { membership } = await this.requireGroupMember(groupId, actorId);
    if (membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can rotate invite links');
    }
    const inviteCode = crypto.randomBytes(8).toString('hex');
    return this.prisma.group.update({ where: { id: groupId }, data: { inviteCode } });
  }

  async joinByInviteCode(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({ where: { inviteCode } });
    if (!group) throw new NotFoundException('Invalid group invite code');
    await this.prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId: group.conversationId, userId },
      },
      update: {},
      create: {
        conversationId: group.conversationId,
        userId,
        role: ConversationMemberRole.MEMBER,
      },
    });
    return group;
  }

  async postAnnouncement(actorId: string, groupId: string, dto: GroupAnnouncementDto) {
    const { group, membership } = await this.requireGroupMember(groupId, actorId);
    if (membership.role === ConversationMemberRole.MEMBER) {
      throw new ForbiddenException('Only group admins can post official group announcements');
    }
    const msg = await this.prisma.message.create({
      data: {
        conversationId: group.conversationId,
        senderId: actorId,
        messageType: MessageType.SYSTEM,
        isEncrypted: false,
        plaintextBody: dto.body.trim(),
        pinned: true,
      },
    });
    this.realtime.emitToConversation(group.conversationId, 'message:received', msg);

    for (const m of group.conversation.members) {
      if (m.userId !== actorId) {
        await this.notifications.enqueueNotification({
          userId: m.userId,
          channel: NotificationChannel.IN_APP,
          eventType: 'GROUP',
          title: `${group.name} Announcement`,
          body: dto.body.trim().slice(0, 140),
          metadata: { groupId: group.id, messageId: msg.id },
        });
      }
    }
    return msg;
  }
}
