import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpChannel } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'alex@company.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'Phone must be in E.164 format (+...)' })
  phone?: string;

  @ApiProperty({ example: 'alex_ops' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/)
  username!: string;

  @ApiProperty({ example: 'Alex Carter' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Desktop Browser' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string;

  @ApiPropertyOptional({ example: 'WEB' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'alex@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ description: 'Required when MFA is enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class RequestOtpDto {
  @ApiProperty({ enum: OtpChannel })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  target!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ enum: OtpChannel })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty()
  @IsString()
  target!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(6, 6)
  otpCode!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  newPassword!: string;
}

export class VerifyMfaCodeDto {
  @ApiProperty()
  @IsString()
  @Length(6, 6)
  code!: string;
}
