import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpsertConfigDto {
  @ApiProperty({ example: 'max_group_members' })
  @IsString()
  @Matches(/^[a-z0-9_.-]{2,80}$/)
  key!: string;

  @ApiProperty()
  @IsObject()
  value!: Record<string, unknown>;
}

export class ToggleMaintenanceDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class UpsertFeatureFlagDto {
  @ApiProperty({ example: 'group_video_calls' })
  @IsString()
  @Matches(/^[a-z0-9_.-]{2,80}$/)
  key!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercent?: number;
}

export class CreateSystemAnnouncementDto {
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

  @ApiPropertyOptional({ default: 'INFO' })
  @IsOptional()
  @IsString()
  severity?: string;
}
