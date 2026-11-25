import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  RegisterPushSubscriptionDto,
  UpdateNotificationPreferencesDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List paginated notifications for current user' })
  list(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.notificationsService.listNotifications(userId, query.page, query.limit);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification delivery preferences' })
  getPreferences(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification delivery preferences' })
  updatePreferences(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(userId, dto);
  }

  @Post('push-subscriptions')
  @ApiOperation({ summary: 'Register Web Push subscription keys' })
  registerPush(@CurrentUser('userId') userId: string, @Body() dto: RegisterPushSubscriptionDto) {
    return this.notificationsService.registerPushSubscription(userId, dto);
  }

  @Get('providers/status')
  @ApiOperation({ summary: 'Check real SMTP, Web Push VAPID, and RabbitMQ configuration status' })
  providerStatus() {
    return this.notificationsService.integrationStatus();
  }
}
