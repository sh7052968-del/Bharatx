import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser, Idempotent, Public, Roles } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CreatePlanDto, RequestRefundDto, SubscribePlanDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'List active subscription plans' })
  listPlans() {
    return this.paymentsService.listPlans();
  }

  @ApiBearerAuth()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DEPT_ADMIN)
  @Post('plans')
  @ApiOperation({ summary: 'Create subscription plan (Admin only)' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.paymentsService.createPlan(dto);
  }

  @ApiBearerAuth()
  @Post('subscribe')
  @Idempotent()
  @ApiOperation({ summary: 'Subscribe to a plan (idempotent; fails closed if Stripe secret unconfigured for paid tiers)' })
  subscribe(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubscribePlanDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.subscribeToPlan(userId, dto, idempotencyKey);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Verify signed Stripe payment webhook' })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.paymentsService.handleStripeWebhook(req.rawBody, signature);
  }

  @ApiBearerAuth()
  @Get('invoices')
  @ApiOperation({ summary: 'List paginated user invoices' })
  invoices(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.paymentsService.listInvoices(userId, query.page, query.limit);
  }

  @ApiBearerAuth()
  @Get('transactions')
  @ApiOperation({ summary: 'List paginated payment transaction logs' })
  transactions(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.paymentsService.listTransactions(userId, query.page, query.limit);
  }

  @ApiBearerAuth()
  @Post('refunds')
  @Idempotent()
  @ApiOperation({ summary: 'Submit refund request into approval workflow' })
  requestRefund(@CurrentUser('userId') userId: string, @Body() dto: RequestRefundDto) {
    return this.paymentsService.requestRefund(userId, dto);
  }
}
