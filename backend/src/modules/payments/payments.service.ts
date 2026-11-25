import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApprovalStatus, InvoiceStatus, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { loadConfig } from '../../config/env.config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto, RequestRefundDto, SubscribePlanDto } from './dto/payments.dto';

@Injectable()
export class PaymentsService {
  private readonly cfg = loadConfig();
  private readonly stripe: Stripe | null;

  constructor(private readonly prisma: PrismaService) {
    this.stripe = this.cfg.stripeSecretKey
      ? new Stripe(this.cfg.stripeSecretKey)
      : null;
  }

  isConfigured(): boolean {
    return Boolean(this.stripe && this.cfg.stripeWebhookSecret);
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        monthlyPriceCents: dto.monthlyPriceCents,
        currency: dto.currency ?? 'USD',
        featuresJson: dto.features,
      },
    });
  }

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: { monthlyPriceCents: 'asc' },
    });
  }

  async subscribeToPlan(userId: string, dto: SubscribePlanDto, idempotencyKey?: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.active) throw new NotFoundException('Subscription plan not found');

    if (plan.monthlyPriceCents === 0) {
      return this.prisma.$transaction(async (tx) => {
        const sub = await tx.businessSubscription.create({
          data: {
            userId,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        const txRecord = await tx.paymentTransaction.create({
          data: {
            userId,
            subscriptionId: sub.id,
            provider: 'INTERNAL_FREE_TIER',
            amountCents: 0,
            currency: plan.currency,
            status: PaymentStatus.SUCCEEDED,
            idempotencyKey: idempotencyKey || uuidv4(),
          },
        });
        const invoice = await tx.invoice.create({
          data: {
            userId,
            transactionId: txRecord.id,
            invoiceNumber: `INV-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`,
            amountCents: 0,
            currency: plan.currency,
            status: InvoiceStatus.PAID,
          },
        });
        return { subscription: sub, transaction: txRecord, invoice };
      });
    }

    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Stripe payment gateway is not configured (STRIPE_SECRET_KEY missing); paid checkout disabled',
      );
    }

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: plan.monthlyPriceCents,
        currency: plan.currency.toLowerCase(),
        metadata: { userId, planId: plan.id, planCode: plan.code },
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    const txRecord = await this.prisma.paymentTransaction.create({
      data: {
        userId,
        provider: 'STRIPE',
        providerTxId: intent.id,
        amountCents: plan.monthlyPriceCents,
        currency: plan.currency,
        status: PaymentStatus.PENDING,
        idempotencyKey: idempotencyKey || uuidv4(),
      },
    });

    return {
      clientSecret: intent.client_secret,
      transaction: txRecord,
      requiresWebhookConfirmation: true,
    };
  }

  async handleStripeWebhook(rawBody: Buffer | undefined, signatureHeader: string | undefined) {
    if (!this.stripe || !this.cfg.stripeWebhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook verification is unconfigured');
    }
    if (!rawBody || !signatureHeader) {
      throw new BadRequestException('Missing raw body or stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signatureHeader,
        this.cfg.stripeWebhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${(err as Error).message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const planId = intent.metadata?.planId;
      const userId = intent.metadata?.userId;

      await this.prisma.$transaction(async (tx) => {
        const existingTx = await tx.paymentTransaction.findUnique({
          where: { providerTxId: intent.id },
        });
        if (!existingTx || existingTx.status === PaymentStatus.SUCCEEDED) return;

        let subId: string | null = null;
        if (planId && userId) {
          const sub = await tx.businessSubscription.create({
            data: {
              userId,
              planId,
              status: SubscriptionStatus.ACTIVE,
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
          subId = sub.id;
        }

        await tx.paymentTransaction.update({
          where: { id: existingTx.id },
          data: { status: PaymentStatus.SUCCEEDED, subscriptionId: subId },
        });

        await tx.invoice.create({
          data: {
            userId: existingTx.userId,
            transactionId: existingTx.id,
            invoiceNumber: `INV-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`,
            amountCents: existingTx.amountCents,
            currency: existingTx.currency,
            status: InvoiceStatus.PAID,
          },
        });
      });
    }

    return { received: true, type: event.type };
  }

  async listInvoices(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where: { userId },
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where: { userId } }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async listTransactions(userId: string, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentTransaction.count({ where: { userId } }),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async requestRefund(userId: string, dto: RequestRefundDto) {
    const txRecord = await this.prisma.paymentTransaction.findUnique({
      where: { id: dto.transactionId },
    });
    if (!txRecord || txRecord.userId !== userId) {
      throw new ForbiddenException('Transaction not found for user');
    }
    if (txRecord.status !== PaymentStatus.SUCCEEDED || txRecord.amountCents === 0) {
      throw new BadRequestException('Only paid succeeded transactions are eligible for refund');
    }

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refundRequest.create({
        data: {
          transactionId: txRecord.id,
          requestedById: userId,
          reason: dto.reason.trim(),
          status: ApprovalStatus.PENDING,
        },
      });
      await tx.approvalWorkflow.create({
        data: {
          workflowType: 'REFUND',
          targetId: refund.id,
          requestedById: userId,
          status: ApprovalStatus.PENDING,
          notes: dto.reason.trim(),
        },
      });
      return refund;
    });
  }
}
