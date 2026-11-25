import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommunityMemberRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class LinkGroupDto {
  @ApiProperty()
  @IsUUID()
  groupId!: string;
}

export class CommunityAnnouncementDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class UpdateCommunityModerationDto {
  @ApiProperty({ enum: CommunityMemberRole })
  @IsEnum(CommunityMemberRole)
  role!: CommunityMemberRole;

  @ApiProperty()
  @IsBoolean()
  canModerate!: boolean;
}
