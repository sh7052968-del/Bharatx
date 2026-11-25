import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CommunityMemberRole } from '@prisma/client';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CommunityAnnouncementDto,
  CreateCommunityDto,
  UpdateCommunityModerationDto,
} from './dto/communities.dto';

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireModerator(communityId: string, userId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member || (member.role !== CommunityMemberRole.OWNER && !member.canModerate)) {
      throw new ForbiddenException('Community moderation privileges required');
    }
    return member;
  }

  async createCommunity(creatorId: string, dto: CreateCommunityDto) {
    return this.prisma.community.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        createdById: creatorId,
        members: {
          create: {
            userId: creatorId,
            role: CommunityMemberRole.OWNER,
            canModerate: true,
          },
        },
      },
      include: { members: true, groups: true },
    });
  }

  async listCommunities(userId: string, page: number, limit: number) {
    const where = { members: { some: { userId } } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.community.findMany({
        where,
        include: { groups: true, _count: { select: { members: true, announcements: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.community.count({ where }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async joinCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    return this.prisma.communityMember.upsert({
      where: { communityId_userId: { communityId, userId } },
      update: {},
      create: {
        communityId,
        userId,
        role: CommunityMemberRole.MEMBER,
        canModerate: false,
      },
    });
  }

  async linkGroup(actorId: string, communityId: string, groupId: string) {
    await this.requireModerator(communityId, actorId);
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Group not found');
    return this.prisma.group.update({
      where: { id: groupId },
      data: { communityId },
    });
  }

  async postAnnouncement(actorId: string, communityId: string, dto: CommunityAnnouncementDto) {
    await this.requireModerator(communityId, actorId);
    return this.prisma.communityAnnouncement.create({
      data: {
        communityId,
        authorId: actorId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        pinned: dto.pinned ?? false,
      },
    });
  }

  async listAnnouncements(userId: string, communityId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member) throw new ForbiddenException('Join the community to view announcements');
    return this.prisma.communityAnnouncement.findMany({
      where: { communityId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateModeration(
    actorId: string,
    communityId: string,
    targetUserId: string,
    dto: UpdateCommunityModerationDto,
  ) {
    const actor = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: actorId } },
    });
    if (!actor || actor.role !== CommunityMemberRole.OWNER) {
      throw new ForbiddenException('Only community owner can modify moderation permissions');
    }
    return this.prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      data: { role: dto.role, canModerate: dto.canModerate },
    });
  }
}
