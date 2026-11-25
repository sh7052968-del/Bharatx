import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { StructuredHttpExceptionFilter } from './common/filters/http-exception.filter';
import {
  JwtAuthGuard,
  MaintenanceGuard,
  PermissionsGuard,
  RolesGuard,
} from './common/guards/auth.guards';
import {
  IdempotencyInterceptor,
  RequestLoggingInterceptor,
} from './common/interceptors/logging-and-idempotency.interceptors';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';
import { CallingModule } from './modules/calling/calling.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { GroupsModule } from './modules/groups/groups.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({ global: true }),
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    RealtimeModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    MessagingModule,
    GroupsModule,
    CommunitiesModule,
    CallingModule,
    BusinessModule,
    PaymentsModule,
    AdminModule,
    SystemModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: StructuredHttpExceptionFilter },
  ],
})
export class AppModule {}
