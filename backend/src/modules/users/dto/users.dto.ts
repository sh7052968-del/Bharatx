import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PresenceStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/)
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  department?: string;
}

export class UpdatePrivacyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLastSeen?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showProfilePhoto?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  readReceiptsEnabled?: boolean;
}

export class UpdatePresenceDto {
  @ApiProperty({ enum: PresenceStatus })
  @IsEnum(PresenceStatus)
  presenceStatus!: PresenceStatus;
}

export class RegisterKeyBundleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  deviceId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  identityPublicKey!: string;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  signedPreKey!: string;

  @ApiProperty()
  @IsString()
  @MinLength(16)
  signedPreKeySignature!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  oneTimePreKeys!: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  keyVersion?: number;
}

export class AddContactDto {
  @ApiProperty()
  @IsUUID()
  contactUserId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nickname?: string;
}

export class BlockUserDto {
  @ApiProperty()
  @IsUUID()
  blockedId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class ReportUserDto {
  @ApiProperty()
  @IsUUID()
  targetUserId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
