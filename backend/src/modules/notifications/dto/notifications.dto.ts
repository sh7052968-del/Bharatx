import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  messageAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  callAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  groupAlerts?: boolean;
}

export class RegisterPushSubscriptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(1024)
  endpoint!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  p256dh!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(512)
  auth!: string;
}
