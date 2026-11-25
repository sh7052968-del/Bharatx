import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationChannel, OtpChannel, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { CryptoService } from '../../common/crypto/crypto.service';
import { loadConfig } from '../../config/env.config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly cfg = loadConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cryptoService: CryptoService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictException('Email, username, or phone already registered');
    }

    const passwordHash = await this.cryptoService.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const superAdminCount = await tx.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });
      const assignedRole =
        superAdminCount === 0 &&
        this.cfg.bootstrapSuperAdminEmail &&
        this.cfg.bootstrapSuperAdminEmail === normalizedEmail
          ? UserRole.SUPER_ADMIN
          : UserRole.MEMBER;

      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          phone: dto.phone ?? null,
          username: normalizedUsername,
          displayName: dto.displayName.trim(),
          passwordHash,
          role: assignedRole,
        },
      });
      await tx.notificationPreference.create({ data: { userId: created.id } });
      return created;
    });

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.email,
      user.role,
      dto.deviceName || 'Primary Client',
      dto.platform || 'WEB',
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        mfaEnabled: user.mfaEnabled,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.suspended) {
      throw new ForbiddenException('Account suspended');
    }

    const validPassword = await this.cryptoService.verifyPassword(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA verification code required');
      }
      if (!user.mfaSecretEncrypted) {
        throw new UnauthorizedException('MFA configuration missing');
      }
      const secret = this.cryptoService.decryptSecret(user.mfaSecretEncrypted);
      if (!this.cryptoService.verifyTotp(secret, dto.mfaCode)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.email,
      user.role,
      dto.deviceName || 'Web Client',
      dto.platform || 'WEB',
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
      },
      ...tokens,
    };
  }

  async refreshSession(dto: RefreshTokenDto) {
    let payload: { sub: string; sid: string; fam: string; jti: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.cfg.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.prisma.deviceSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session revoked or expired');
    }

    const incomingHash = this.cryptoService.sha256(dto.refreshToken);
    if (!this.cryptoService.timingSafeEqualsHex(session.refreshTokenHash, incomingHash)) {
      // Replay attack detected: revoke the entire refresh-token family
      await this.prisma.deviceSession.updateMany({
        where: { refreshTokenFamily: session.refreshTokenFamily },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected; session family revoked');
    }

    const nextVersion = session.tokenVersion + 1;
    const accessToken = await this.signAccessToken(session.user.id, session.id, session.user.role, session.user.email, nextVersion);
    const nextRefreshToken = await this.signRefreshToken(session.user.id, session.id, session.refreshTokenFamily);

    await this.prisma.deviceSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.cryptoService.sha256(nextRefreshToken),
        tokenVersion: nextVersion,
        lastActiveAt: new Date(),
      },
    });

    return {
      sessionId: session.id,
      accessToken,
      refreshToken: nextRefreshToken,
    };
  }

  async logout(sessionId: string) {
    await this.prisma.deviceSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async requestOtp(dto: RequestOtpDto) {
    const target = dto.target.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: dto.channel === OtpChannel.MOBILE ? { phone: dto.target.trim() } : { email: target },
    });
    if (!user) {
      throw new BadRequestException('No matching account found for OTP target');
    }

    const code = this.cryptoService.generateNumericOtp(6);
    const codeHash = this.cryptoService.sha256(code);
    const otp = await this.prisma.otpVerification.create({
      data: {
        userId: user.id,
        target: dto.target.trim(),
        channel: dto.channel,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    let deliveryStatus = 'UNCONFIGURED';
    if (dto.channel === OtpChannel.EMAIL || dto.channel === OtpChannel.PASSWORD_RESET) {
      const notif = await this.notificationsService.enqueueNotification({
        userId: user.id,
        channel: NotificationChannel.EMAIL,
        eventType: 'OTP',
        title: 'ConnectX Security Verification Code',
        body: `Your ConnectX verification code is ${code}. It expires in 10 minutes.`,
      });
      deliveryStatus = notif?.deliveryStatus ?? 'UNCONFIGURED';
    }

    return {
      otpId: otp.id,
      channel: dto.channel,
      expiresAt: otp.expiresAt,
      deliveryStatus,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpVerification.findFirst({
      where: {
        channel: dto.channel,
        target: dto.target.trim(),
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired or not found');
    }
    if (otp.attempts >= 5) {
      throw new ForbiddenException('Maximum OTP verification attempts exceeded');
    }

    const incomingHash = this.cryptoService.sha256(dto.code.trim());
    if (!this.cryptoService.timingSafeEqualsHex(otp.codeHash, incomingHash)) {
      await this.prisma.otpVerification.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.otpVerification.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      if (dto.channel === OtpChannel.EMAIL) {
        await tx.user.update({ where: { id: otp.userId }, data: { emailVerified: true } });
      } else if (dto.channel === OtpChannel.MOBILE) {
        await tx.user.update({ where: { id: otp.userId }, data: { phoneVerified: true } });
      }
    });

    return { verified: true, channel: dto.channel };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid password reset request');
    }

    const otp = await this.prisma.otpVerification.findFirst({
      where: {
        userId: user.id,
        channel: OtpChannel.PASSWORD_RESET,
        consumedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date() || otp.attempts >= 5) {
      throw new BadRequestException('Password reset OTP invalid or expired');
    }

    const incomingHash = this.cryptoService.sha256(dto.otpCode.trim());
    if (!this.cryptoService.timingSafeEqualsHex(otp.codeHash, incomingHash)) {
      await this.prisma.otpVerification.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid reset code');
    }

    const newHash = await this.cryptoService.hashPassword(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.otpVerification.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      }),
      this.prisma.deviceSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { passwordReset: true };
  }

  async enrollMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = this.cryptoService.generateBase32Secret(20);
    const encrypted = this.cryptoService.encryptSecret(secret);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEncrypted: encrypted },
    });
    const issuer = encodeURIComponent('ConnectX');
    const account = encodeURIComponent(user.email);
    return {
      otpauthUri: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      secret,
    };
  }

  async activateMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEncrypted) {
      throw new BadRequestException('MFA enrollment has not been initiated');
    }
    const secret = this.cryptoService.decryptSecret(user.mfaSecretEncrypted);
    if (!this.cryptoService.verifyTotp(secret, code)) {
      throw new UnauthorizedException('Invalid TOTP verification code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
    return { mfaEnabled: true };
  }

  async disableMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new BadRequestException('MFA is not active');
    }
    const secret = this.cryptoService.decryptSecret(user.mfaSecretEncrypted);
    if (!this.cryptoService.verifyTotp(secret, code)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEncrypted: null },
    });
    return { mfaEnabled: false };
  }

  async listDevices(userId: string) {
    return this.prisma.deviceSession.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        deviceName: true,
        platform: true,
        ipAddress: true,
        lastActiveAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async revokeDevice(userId: string, sessionId: string) {
    const result = await this.prisma.deviceSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException('Active device session not found');
    }
    return { revoked: true };
  }

  private async createSessionAndTokens(
    userId: string,
    email: string,
    role: UserRole,
    deviceName: string,
    platform: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const sessionId = crypto.randomUUID();
    const family = crypto.randomUUID();
    const refreshToken = await this.signRefreshToken(userId, sessionId, family);
    const accessToken = await this.signAccessToken(userId, sessionId, role, email, 1);

    await this.prisma.deviceSession.create({
      data: {
        id: sessionId,
        userId,
        deviceName,
        platform,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        refreshTokenHash: this.cryptoService.sha256(refreshToken),
        refreshTokenFamily: family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return { sessionId, accessToken, refreshToken };
  }

  private parseDurationSeconds(raw: string, fallbackSec: number): number {
    const match = /^(\d+)([smhd])$/i.exec(raw.trim());
    if (!match) {
      const asNum = Number(raw);
      return Number.isFinite(asNum) && asNum > 0 ? asNum : fallbackSec;
    }
    const val = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 's') return val;
    if (unit === 'm') return val * 60;
    if (unit === 'h') return val * 3600;
    return val * 86400;
  }

  private signAccessToken(
    userId: string,
    sessionId: string,
    role: UserRole,
    email: string,
    tokenVersion: number,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, sid: sessionId, role, email, tv: tokenVersion },
      {
        secret: this.cfg.jwtAccessSecret,
        expiresIn: this.parseDurationSeconds(this.cfg.jwtAccessExpiresIn, 900),
      },
    );
  }

  private signRefreshToken(userId: string, sessionId: string, family: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, sid: sessionId, fam: family, jti: crypto.randomUUID() },
      {
        secret: this.cfg.jwtRefreshSecret,
        expiresIn: this.parseDurationSeconds(this.cfg.jwtRefreshExpiresIn, 604800),
      },
    );
  }
}
