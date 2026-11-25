import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { loadConfig } from '../../config/env.config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AuthenticatedPrincipal,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
} from '../decorators/auth.decorators';

export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  PLATFORM_ADMIN: [
    'overview:read',
    'users:read',
    'users:write',
    'features:read',
    'features:write',
    'business:read',
    'notifications:read',
    'notifications:write',
    'analytics:read',
    'analytics:export',
    'settings:read',
    'settings:write',
    'developer:read',
    'developer:write',
    'approvals:review',
  ],
  SECURITY_ADMIN: [
    'overview:read',
    'users:read',
    'users:write',
    'users:delete',
    'admins:read',
    'admins:write',
    'audit:read',
    'audit:export',
    'moderation:read',
    'moderation:write',
    'settings:read',
    'settings:write',
    'approvals:review',
  ],
  BUSINESS_ADMIN: [
    'overview:read',
    'business:read',
    'business:write',
    'business:approve',
    'moderation:read',
    'analytics:read',
    'analytics:export',
    'approvals:review',
  ],
  FINANCE_ADMIN: [
    'overview:read',
    'finance:read',
    'finance:write',
    'finance:approve',
    'analytics:read',
    'analytics:export',
    'audit:read',
    'approvals:review',
  ],
  CONTENT_MODERATOR: [
    'overview:read',
    'users:read',
    'users:write',
    'business:read',
    'moderation:read',
    'moderation:write',
    'moderation:approve',
    'audit:read',
  ],
  SUPPORT_ADMIN: [
    'overview:read',
    'users:read',
    'users:write',
    'moderation:read',
    'notifications:read',
    'notifications:write',
  ],
  CUSTOM_ADMIN: ['overview:read'],
  DEPT_ADMIN: [
    'overview:read',
    'users:read',
    'users:write',
    'business:read',
    'business:approve',
    'approvals:review',
    'audit:read',
    'features:read',
    'features:write',
    'notifications:read',
    'notifications:write',
    'settings:read',
  ],
  BUSINESS_MANAGER: ['business:read', 'business:write'],
  AGENT: ['users:read', 'moderation:read'],
  MEMBER: [],
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessSecret = loadConfig().jwtAccessSecret;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedPrincipal;
    }>();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer access token');
    }
    const token = authHeader.slice(7).trim();

    let payload: { sub: string; sid: string; role: UserRole; email: string; tv?: number };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.accessSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const session = await this.prisma.deviceSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: {
            customRole: true,
            adminUser: {
              include: {
                roles: {
                  include: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired or been revoked');
    }
    if (session.user.suspended || session.user.bannedAt) {
      throw new ForbiddenException('Account suspended or banned');
    }

    const adminUser = session.user.adminUser;
    const isAdminRestricted = adminUser ? !adminUser.active : false;
    const adminAssignedPerms =
      !isAdminRestricted && adminUser?.roles
        ? adminUser.roles.flatMap((link) => link.role.permissions ?? [])
        : [];
    const customPerms = session.user.customRole?.permissions ?? [];
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[session.user.role] ?? [];
    const mergedPermissions = isAdminRestricted
      ? []
      : Array.from(new Set([...roleDefaults, ...customPerms, ...adminAssignedPerms]));

    req.user = {
      userId: session.user.id,
      sessionId: session.id,
      role: session.user.role,
      permissions: mergedPermissions,
      email: session.user.email,
    };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedPrincipal }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    if (user.role === UserRole.SUPER_ADMIN || requiredRoles.includes(user.role)) {
      return true;
    }
    throw new ForbiddenException('Insufficient role privileges');
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPerms || requiredPerms.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedPrincipal }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    if (user.role === UserRole.SUPER_ADMIN || user.permissions.includes('*')) return true;
    const hasAll = requiredPerms.every((perm) => user.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException('Missing required permission: ' + requiredPerms.join(', '));
    }
    return true;
  }
}

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      path: string;
      user?: AuthenticatedPrincipal;
    }>();
    if (req.path.startsWith('/api/v1/system')) return true;
    if (req.user?.role === UserRole.SUPER_ADMIN) return true;

    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'maintenance_mode' },
    });
    const enabled = Boolean((config?.valueJson as { enabled?: boolean } | null)?.enabled);
    if (enabled) {
      throw new ServiceUnavailableException('ConnectX is temporarily in scheduled maintenance mode');
    }
    return true;
  }
}
