import { Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  ResetPasswordDto,
  VerifyMfaCodeDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user account with Argon2id password hashing' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and issue JWT + rotating refresh token' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token with replay reuse detection' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshSession(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Revoke current session' })
  logout(@CurrentUser('sessionId') sessionId: string) {
    return this.authService.logout(sessionId);
  }

  @Public()
  @Post('otp/request')
  @ApiOperation({ summary: 'Issue mobile, email, or password-reset OTP' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP code' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('password/reset')
  @ApiOperation({ summary: 'Reset password using verified password-reset OTP and revoke active sessions' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Post('mfa/enroll')
  @ApiOperation({ summary: 'Generate TOTP MFA secret and otpauth URI' })
  enrollMfa(@CurrentUser('userId') userId: string) {
    return this.authService.enrollMfa(userId);
  }

  @ApiBearerAuth()
  @Post('mfa/activate')
  @ApiOperation({ summary: 'Verify TOTP code and enable MFA' })
  activateMfa(@CurrentUser('userId') userId: string, @Body() dto: VerifyMfaCodeDto) {
    return this.authService.activateMfa(userId, dto.code);
  }

  @ApiBearerAuth()
  @Post('mfa/disable')
  @ApiOperation({ summary: 'Disable TOTP MFA after verifying active code' })
  disableMfa(@CurrentUser('userId') userId: string, @Body() dto: VerifyMfaCodeDto) {
    return this.authService.disableMfa(userId, dto.code);
  }

  @ApiBearerAuth()
  @Get('devices')
  @ApiOperation({ summary: 'List active authenticated devices and sessions' })
  devices(@CurrentUser('userId') userId: string) {
    return this.authService.listDevices(userId);
  }

  @ApiBearerAuth()
  @Delete('devices/:sessionId')
  @ApiOperation({ summary: 'Revoke a device session' })
  revokeDevice(@CurrentUser('userId') userId: string, @Param('sessionId') sessionId: string) {
    return this.authService.revokeDevice(userId, sessionId);
  }
}
