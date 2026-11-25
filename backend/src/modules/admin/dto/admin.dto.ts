import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApprovalStatus,
  NotificationChannel,
  UserRole,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminUsersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'VERIFIED' | 'UNVERIFIED';

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  limit?: number;
}

export class CreateCustomRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiProperty({ type: [String], example: ['users:read', 'business:approve'] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

export class UpdateCustomRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateUserGovernanceDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customRoleId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  suspended?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}

export class UserModerationActionDto {
  @ApiProperty({ enum: ['VERIFY', 'SUSPEND', 'BAN', 'RESTORE'] })
  @IsString()
  action!: 'VERIFY' | 'SUSPEND' | 'BAN' | 'RESTORE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class CreateAdminAccountDto {
  @ApiProperty()
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  temporaryPassword!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customRoleId?: string;
}

export class UpdateAdminAccountDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customRoleId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReviewApprovalDto {
  @ApiProperty({ enum: [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED] })
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateFeatureModuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settingsJson?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependsOnKeys?: string[];
}

export class UpdateFeatureFlagDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eligibilityJson?: Record<string, unknown>;
}

export class RollbackFeatureConfigDto {
  @ApiProperty()
  @IsString()
  snapshotId!: string;
}

export class VerifyBusinessDto {
  @ApiProperty({ enum: ['VERIFIED', 'REJECTED'] })
  @IsString()
  status!: 'VERIFIED' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}

export class RestrictBusinessDto {
  @ApiProperty()
  @IsBoolean()
  restricted!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ModerateProductDto {
  @ApiProperty()
  @IsBoolean()
  inStock!: boolean;
}

export class ModerationDecisionDto {
  @ApiProperty({ enum: ['DISMISS', 'WARN', 'SUSPEND_TARGET', 'BAN_TARGET'] })
  @IsString()
  decision!: 'DISMISS' | 'WARN' | 'SUSPEND_TARGET' | 'BAN_TARGET';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

export class UpsertSubscriptionPlanDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z0-9_]{2,32}$/)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  monthlyPriceCents!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  features!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateRefundRequestDto {
  @ApiProperty()
  @IsString()
  transactionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(300)
  reason!: string;
}

export class UpsertNotificationTemplateDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9._-]{3,80}$/)
  templateKey!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subjectTemplate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  bodyTemplate!: string;

  @ApiPropertyOptional({ default: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;
}

export class BroadcastCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiPropertyOptional({ default: 'ALL' })
  @IsOptional()
  @IsString()
  audience?: 'ALL' | 'ADMINS' | 'BUSINESS_OWNERS';
}

export class UpdateSystemSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  branding?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  localization?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  privacy?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  notifications?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maintenanceReason?: string;
}

export class CreateReleaseDto {
  @ApiProperty({ example: 'BACKEND' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  platform!: string;

  @ApiProperty({ example: '2.1.0' })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/)
  version!: string;

  @ApiProperty({ example: 210 })
  @IsInt()
  @Min(1)
  buildNumber!: number;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(1000)
  releaseNotes!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  minSupported?: boolean;
}
