import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  BusinessVerificationStatus,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import * as crypto from 'crypto';
import { CryptoService } from '../../common/crypto/crypto.service';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { RabbitMqService } from '../../rabbitmq/rabbitmq.module';
import { RedisService } from '../../redis/redis.module';
import {
  AdminUsersQueryDto,
  CreateAdminAccountDto,
  CreateCustomRoleDto,
  ReviewApprovalDto,
  UpdateAdminAccountDto,
  UpdateCustomRoleDto,
  UpdateUserGovernanceDto,
  UserModerationActionDto,
} from './dto/admin.dto';

export const ADMIN_MODULE_PERMISSION_CATALOG = [
  'overview:read',
  'users:read',
  'users:write',
  'users:delete',
  'admins:read',
  'admins:write',
  'admins:delete',
  'roles:manage',
  'features:read',
  'features:write',
  'features:approve',
  'business:read',
  'business:write',
  'business:approve',
  'moderation:read',
  'moderation:write',
  'moderation:approve',
  'finance:read',
  'finance:write',
  'finance:approve',
  'notifications:read',
  'notifications:write',
  'analytics:read',
  'analytics:export',
  'settings:read',
  'settings:write',
  'audit:read',
  'audit:export',
  'developer:read',
  'developer:write',
  'developer:approve',
  'approvals:review',
];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly cryptoService: CryptoService,
  ) {}

  async logAction(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    summary: string,
    ipAddress?: string,
    category = 'ADMIN_ACTION',
  ) {
    const previous = await this.prisma.adminAuditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { entryHash: true },
    });
    const previousHash = previous?.entryHash ?? 'GENESIS';
    const payload = `${previousHash}|${actorId}|${category}|${action}|${targetType}|${targetId}|${summary}`;
    const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

    await this.prisma.adminAuditLog.create({
      data: {
        actorId,
        category,
        action,
        targetType,
        targetId,
        summary,
        ipAddress: ipAddress ?? null,
        previousHash,
        entryHash,
      },
    });
  }

  // ============================================================================
  // A. OVERVIEW (Aggregate Metadata Only — Never E2EE Private Content)
  // ============================================================================

  async getOverview() {
    const cacheKey = 'admin:overview:v1';
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as Record<string, unknown>;
    }

    const activeWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      totalUsers,
      activeUsers,
      onlineUsers,
      totalMessages,
      totalGroups,
      totalBusinesses,
      totalCalls,
      storageAgg,
      openReports,
      pendingApprovals,
      recentAuditEvents,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, lastSeenAt: { gte: activeWindow } },
      }),
      this.prisma.user.count({
        where: { deletedAt: null, presenceStatus: 'ONLINE' },
      }),
      // Count only — strict E2EE isolation prevents inspecting message bodies
      this.prisma.message.count(),
      this.prisma.group.count({ where: { deletedAt: null } }),
      this.prisma.businessProfile.count({ where: { deletedAt: null } }),
      this.prisma.callSession.count(),
      this.prisma.mediaObject.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.abuseReport.count({ where: { status: 'OPEN' } }),
      this.prisma.approvalWorkflow.count({ where: { status: ApprovalStatus.PENDING } }),
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { id: true, email: true, displayName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    let dbHealth: 'CONNECTED' | 'ERROR' = 'CONNECTED';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbHealth = 'ERROR';
    }

    const result = {
      metrics: {
        totalUsers,
        activeUsers,
        onlineUsers,
        totalMessages,
        totalGroups,
        totalBusinesses,
        totalCalls,
        storageBytes: storageAgg._sum.sizeBytes ?? 0,
        openReports,
        pendingApprovals,
      },
      serverHealth: {
        status: dbHealth === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
        postgresql: dbHealth,
        redis: await this.redis.ping(),
        rabbitmq: this.rabbitMq.status(),
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssBytes: process.memoryUsage().rss,
      },
      systemActivity: recentAuditEvents,
      e2eeBoundary: 'AGGREGATE_METADATA_ONLY',
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 15);
    return result;
  }

  // ============================================================================
  // B. USER MANAGEMENT
  // ============================================================================

  async listUsersFiltered(
    actorRole: UserRole,
    actorId: string,
    query: AdminUsersQueryDto,
  ) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25)));

    let departmentFilter: string | undefined;
    if (actorRole === UserRole.DEPT_ADMIN) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      departmentFilter = actor?.department;
    }

    const where: Record<string, unknown> = { deletedAt: null };
    if (departmentFilter) where.department = departmentFilter;
    if (query.role) where.role = query.role;
    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { email: { contains: s, mode: 'insensitive' } },
        { username: { contains: s, mode: 'insensitive' } },
        { displayName: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (query.status === 'SUSPENDED') {
      where.suspended = true;
      where.bannedAt = null;
    } else if (query.status === 'BANNED') {
      where.bannedAt = { not: null };
    } else if (query.status === 'ACTIVE') {
      where.suspended = false;
      where.bannedAt = null;
    } else if (query.status === 'VERIFIED') {
      where.emailVerified = true;
    } else if (query.status === 'UNVERIFIED') {
      where.emailVerified = false;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
          displayName: true,
          role: true,
          customRoleId: true,
          department: true,
          suspended: true,
          bannedAt: true,
          banReason: true,
          emailVerified: true,
          phoneVerified: true,
          mfaEnabled: true,
          presenceStatus: true,
          lastSeenAt: true,
          createdAt: true,
          _count: { select: { reportsReceived: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async listUsers(actorRole: UserRole, actorId: string, page: number, limit: number) {
    return this.listUsersFiltered(actorRole, actorId, { page, limit });
  }

  async updateUserGovernance(
    actorId: string,
    actorRole: UserRole,
    targetUserId: string,
    dto: UpdateUserGovernanceDto,
    ip?: string,
  ) {
    if (dto.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin may assign SUPER_ADMIN role');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Target user not found');

    if (actorRole === UserRole.DEPT_ADMIN) {
      const actor = await this.prisma.user.findUnique({ where: { id: actorId } });
      if (actor?.department !== target.department) {
        throw new ForbiddenException('Department Admins may only manage users in their department');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: dto,
      select: {
        id: true,
        email: true,
        role: true,
        customRoleId: true,
        department: true,
        suspended: true,
        emailVerified: true,
      },
    });
    await this.logAction(
      actorId,
      'USER_GOVERNANCE_UPDATED',
      'User',
      targetUserId,
      `Updated role=${updated.role}, suspended=${updated.suspended}`,
      ip,
      'PERMISSION_CHANGE',
    );
    return updated;
  }

  async performUserModerationAction(
    actorId: string,
    actorRole: UserRole,
    targetUserId: string,
    dto: UserModerationActionDto,
    ip?: string,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Target user not found');
    if (target.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can moderate a Super Admin account');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.action === 'VERIFY') {
      updateData.emailVerified = true;
    } else if (dto.action === 'SUSPEND') {
      updateData.suspended = true;
    } else if (dto.action === 'BAN') {
      updateData.suspended = true;
      updateData.bannedAt = new Date();
      updateData.banReason = dto.reason?.trim() || 'Policy violation';
    } else if (dto.action === 'RESTORE') {
      updateData.suspended = false;
      updateData.bannedAt = null;
      updateData.banReason = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: targetUserId },
        data: updateData,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          emailVerified: true,
          suspended: true,
          bannedAt: true,
          banReason: true,
        },
      });
      if (dto.action === 'SUSPEND' || dto.action === 'BAN') {
        await tx.deviceSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return u;
    });

    await this.logAction(
      actorId,
      `USER_${dto.action}`,
      'User',
      targetUserId,
      `${dto.action} user ${target.email}${dto.reason ? ` (${dto.reason})` : ''}`,
      ip,
      dto.action === 'BAN' || dto.action === 'SUSPEND' ? 'SECURITY_EVENT' : 'ADMIN_ACTION',
    );
    await this.redis.del('admin:overview:v1');
    return updated;
  }

  // ============================================================================
  // C. ADMIN MANAGEMENT
  // ============================================================================

  async listAdmins() {
    const adminRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.PLATFORM_ADMIN,
      UserRole.SECURITY_ADMIN,
      UserRole.BUSINESS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.CONTENT_MODERATOR,
      UserRole.SUPPORT_ADMIN,
      UserRole.CUSTOM_ADMIN,
      UserRole.DEPT_ADMIN,
    ];
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ role: { in: adminRoles } }, { adminUser: { isNot: null } }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        customRoleId: true,
        customRole: { select: { id: true, name: true, permissions: true } },
        department: true,
        mfaEnabled: true,
        suspended: true,
        lastSeenAt: true,
        createdAt: true,
        adminUser: {
          include: { roles: { include: { role: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAdminAccount(actorId: string, actorRole: UserRole, dto: CreateAdminAccountDto, ip?: string) {
    if (dto.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin may create another SUPER_ADMIN');
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Account with this email already exists; edit existing user instead');
    }
    const passwordHash = await this.cryptoService.hashPassword(dto.temporaryPassword);
    const usernameBase = email.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'admin';
    const username = `${usernameBase}_${crypto.randomBytes(2).toString('hex')}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          username,
          displayName: dto.displayName.trim(),
          passwordHash,
          role: dto.role,
          department: dto.department?.trim() || 'Administration',
          customRoleId: dto.customRoleId ?? null,
          emailVerified: true,
        },
      });
      await tx.notificationPreference.create({ data: { userId: user.id } });
      const adminRec = await tx.adminUser.create({
        data: { userId: user.id, department: user.department, active: true },
      });
      if (dto.customRoleId) {
        await tx.adminUserRole.create({
          data: { adminUserId: adminRec.id, roleId: dto.customRoleId },
        });
      }
      return user;
    });

    await this.logAction(
      actorId,
      'ADMIN_ACCOUNT_CREATED',
      'AdminUser',
      created.id,
      `Provisioned admin ${created.email} with role=${created.role}`,
      ip,
      'PERMISSION_CHANGE',
    );
    return {
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      role: created.role,
      department: created.department,
    };
  }

  async updateAdminAccount(
    actorId: string,
    actorRole: UserRole,
    targetUserId: string,
    dto: UpdateAdminAccountDto,
    ip?: string,
  ) {
    if (dto.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin may assign SUPER_ADMIN');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Admin user not found');
    if (target.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can modify another Super Admin');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: {
          ...(dto.role ? { role: dto.role } : {}),
          ...(dto.department ? { department: dto.department } : {}),
          ...(dto.customRoleId !== undefined ? { customRoleId: dto.customRoleId } : {}),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          department: true,
          customRoleId: true,
        },
      });

      const adminUser = await tx.adminUser.upsert({
        where: { userId: targetUserId },
        update: {
          ...(dto.department ? { department: dto.department } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
        create: {
          userId: targetUserId,
          department: dto.department ?? target.department,
          active: dto.active ?? true,
        },
      });

      if (dto.active === false) {
        await tx.deviceSession.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      if (dto.customRoleId) {
        await tx.adminUserRole.upsert({
          where: { adminUserId_roleId: { adminUserId: adminUser.id, roleId: dto.customRoleId } },
          update: {},
          create: { adminUserId: adminUser.id, roleId: dto.customRoleId },
        });
      }

      return { ...user, active: adminUser.active };
    });

    await this.logAction(
      actorId,
      'ADMIN_ACCOUNT_UPDATED',
      'AdminUser',
      targetUserId,
      `Updated admin ${target.email}: role=${updated.role}, active=${updated.active}`,
      ip,
      'PERMISSION_CHANGE',
    );
    return updated;
  }

  async removeAdminAccount(actorId: string, actorRole: UserRole, targetUserId: string, ip?: string) {
    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot remove your own administrator privileges');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Admin user not found');
    if (target.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can demote a Super Admin');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: { role: UserRole.MEMBER, customRoleId: null },
      });
      await tx.adminUser.deleteMany({ where: { userId: targetUserId } });
      await tx.deviceSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.logAction(
      actorId,
      'ADMIN_ACCESS_REMOVED',
      'AdminUser',
      targetUserId,
      `Removed admin privileges from ${target.email}`,
      ip,
      'SECURITY_EVENT',
    );
    return { removed: true, userId: targetUserId };
  }

  async listAdminLoginHistory() {
    const adminRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.PLATFORM_ADMIN,
      UserRole.SECURITY_ADMIN,
      UserRole.BUSINESS_ADMIN,
      UserRole.FINANCE_ADMIN,
      UserRole.CONTENT_MODERATOR,
      UserRole.SUPPORT_ADMIN,
      UserRole.CUSTOM_ADMIN,
      UserRole.DEPT_ADMIN,
    ];
    return this.prisma.deviceSession.findMany({
      where: { user: { role: { in: adminRoles } } },
      include: {
        user: { select: { id: true, email: true, displayName: true, role: true, mfaEnabled: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================================================
  // D. ROLE AND PERMISSION CENTER
  // ============================================================================

  async createCustomRole(actorId: string, dto: CreateCustomRoleDto, ip?: string) {
    const role = await this.prisma.customAdminRole.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        permissions: dto.permissions,
        createdById: actorId,
      },
    });
    await this.logAction(
      actorId,
      'CUSTOM_ROLE_CREATED',
      'CustomAdminRole',
      role.id,
      `Created role ${role.name}`,
      ip,
      'PERMISSION_CHANGE',
    );
    return role;
  }

  async updateCustomRole(actorId: string, roleId: string, dto: UpdateCustomRoleDto, ip?: string) {
    const existing = await this.prisma.customAdminRole.findUnique({ where: { id: roleId } });
    if (!existing) throw new NotFoundException('Role not found');
    const updated = await this.prisma.customAdminRole.update({
      where: { id: roleId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
        ...(dto.permissions ? { permissions: dto.permissions } : {}),
      },
    });
    await this.logAction(
      actorId,
      'CUSTOM_ROLE_UPDATED',
      'CustomAdminRole',
      roleId,
      `Updated role ${updated.name} (${updated.permissions.length} permissions)`,
      ip,
      'PERMISSION_CHANGE',
    );
    return updated;
  }

  async deleteCustomRole(actorId: string, roleId: string, ip?: string) {
    const existing = await this.prisma.customAdminRole.findUnique({ where: { id: roleId } });
    if (!existing) throw new NotFoundException('Role not found');
    await this.prisma.customAdminRole.delete({ where: { id: roleId } });
    await this.logAction(
      actorId,
      'CUSTOM_ROLE_DELETED',
      'CustomAdminRole',
      roleId,
      `Deleted custom role ${existing.name}`,
      ip,
      'PERMISSION_CHANGE',
    );
    return { deleted: true, roleId };
  }

  async listCustomRoles() {
    return this.prisma.customAdminRole.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listPermissionCatalog() {
    const dbPerms = await this.prisma.adminPermission.findMany({ orderBy: { code: 'asc' } });
    return {
      dbPermissions: dbPerms,
      modulePermissionCatalog: ADMIN_MODULE_PERMISSION_CATALOG,
    };
  }

  // ============================================================================
  // L. APPROVALS & TAMPER-EVIDENT AUDIT CENTER
  // ============================================================================

  async listApprovals(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.approvalWorkflow.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.approvalWorkflow.count(),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async reviewApproval(
    actorId: string,
    actorRole: UserRole,
    approvalId: string,
    dto: ReviewApprovalDto,
    ip?: string,
  ) {
    const workflow = await this.prisma.approvalWorkflow.findUnique({ where: { id: approvalId } });
    if (!workflow) throw new NotFoundException('Approval workflow not found');
    if (workflow.workflowType === 'PRODUCTION_RELEASE' && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin may approve production releases');
    }
    if (workflow.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException('Approval workflow has already been processed');
    }
    if (dto.status === ApprovalStatus.PENDING) {
      throw new BadRequestException('Decision must be APPROVED or REJECTED');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedWorkflow = await tx.approvalWorkflow.update({
        where: { id: workflow.id },
        data: {
          status: dto.status,
          reviewedById: actorId,
          notes: dto.notes?.trim() ?? workflow.notes,
        },
      });

      if (workflow.workflowType === 'BUSINESS_VERIFICATION') {
        await tx.businessProfile.update({
          where: { id: workflow.targetId },
          data: {
            verificationStatus:
              dto.status === ApprovalStatus.APPROVED
                ? BusinessVerificationStatus.VERIFIED
                : BusinessVerificationStatus.REJECTED,
          },
        });
      } else if (workflow.workflowType === 'REFUND') {
        const refund = await tx.refundRequest.update({
          where: { id: workflow.targetId },
          data: { status: dto.status, reviewedById: actorId },
        });
        if (dto.status === ApprovalStatus.APPROVED) {
          await tx.paymentTransaction.update({
            where: { id: refund.transactionId },
            data: { status: PaymentStatus.REFUNDED },
          });
        }
      } else if (workflow.workflowType === 'PRODUCTION_RELEASE' && dto.status === ApprovalStatus.APPROVED) {
        await tx.appRelease.update({
          where: { id: workflow.targetId },
          data: { stage: 'PRODUCTION', approvedById: actorId },
        });
      }

      return updatedWorkflow;
    });

    await this.logAction(
      actorId,
      'APPROVAL_DECISION',
      workflow.workflowType,
      workflow.targetId,
      `Decision=${dto.status}`,
      ip,
      'APPROVAL',
    );
    return result;
  }

  async listAuditLogs(
    page: number,
    limit: number,
    category?: string,
    search?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }
    if (search?.trim()) {
      const s = search.trim();
      where.OR = [
        { action: { contains: s, mode: 'insensitive' } },
        { summary: { contains: s, mode: 'insensitive' } },
        { targetType: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        where,
        include: { actor: { select: { id: true, email: true, displayName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.adminAuditLog.count({ where }),
    ]);

    return {
      ...buildPaginatedResponse(items, total, page, limit),
      tamperEvidentChainActive: true,
    };
  }
}
