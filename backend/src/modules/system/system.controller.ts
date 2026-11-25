import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators/auth.decorators';
import {
  CreateSystemAnnouncementDto,
  ToggleMaintenanceDto,
  UpsertConfigDto,
  UpsertFeatureFlagDto,
} from './dto/system.dto';
import { SystemService } from './system.service';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check server, PostgreSQL, Redis, RabbitMQ, and maintenance health' })
  health() {
    return this.systemService.getHealth();
  }

  @Public()
  @Get('announcements')
  @ApiOperation({ summary: 'List active system-wide announcements' })
  announcements() {
    return this.systemService.listAnnouncements();
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Put('config')
  @ApiOperation({ summary: 'Upsert global application configuration' })
  upsertConfig(@CurrentUser('userId') actorId: string, @Body() dto: UpsertConfigDto) {
    return this.systemService.upsertConfig(actorId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  @Get('config')
  @ApiOperation({ summary: 'List global application configurations' })
  listConfigs() {
    return this.systemService.listConfigs();
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Put('maintenance')
  @ApiOperation({ summary: 'Enable or disable system-wide maintenance mode' })
  maintenance(@CurrentUser('userId') actorId: string, @Body() dto: ToggleMaintenanceDto) {
    return this.systemService.setMaintenanceMode(actorId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  @Put('feature-flags')
  @ApiOperation({ summary: 'Create or toggle a feature flag' })
  upsertFlag(@CurrentUser('userId') actorId: string, @Body() dto: UpsertFeatureFlagDto) {
    return this.systemService.upsertFeatureFlag(actorId, dto);
  }

  @ApiBearerAuth()
  @Get('feature-flags')
  @ApiOperation({ summary: 'List feature flags' })
  listFlags() {
    return this.systemService.listFeatureFlags();
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  @Post('announcements')
  @ApiOperation({ summary: 'Publish a system-wide announcement' })
  createAnnouncement(
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateSystemAnnouncementDto,
  ) {
    return this.systemService.createAnnouncement(actorId, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Post('backups')
  @ApiOperation({ summary: 'Trigger and record a verified backup manifest snapshot' })
  triggerBackup(@CurrentUser('userId') actorId: string) {
    return this.systemService.createBackupManifest(actorId);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN)
  @Get('backups')
  @ApiOperation({ summary: 'List recorded backup manifests' })
  listBackups() {
    return this.systemService.listBackups();
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  @Get('logs')
  @ApiOperation({ summary: 'Inspect runtime metrics and recent audit log summary' })
  logs() {
    return this.systemService.getSystemLogsSummary();
  }
}
