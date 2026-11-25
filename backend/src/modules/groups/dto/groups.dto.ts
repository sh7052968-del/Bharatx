import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationMemberRole } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  announcementsOnly?: boolean;
}

export class UpdateGroupPermissionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  announcementsOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlyAdminsCanEditInfo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  onlyAdminsCanInvite?: boolean;
}

export class AddGroupMemberDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiPropertyOptional({ enum: ConversationMemberRole })
  @IsOptional()
  @IsEnum(ConversationMemberRole)
  role?: ConversationMemberRole;
}

export class GroupAnnouncementDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
