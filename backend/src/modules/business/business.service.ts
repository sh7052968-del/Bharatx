import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  BusinessVerificationStatus,
  OrderStatus,
} from '@prisma/client';
import { buildPaginatedResponse } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AddCustomerNoteDto,
  CreateOrderInquiryDto,
  CreateProductDto,
  CreateQuickReplyDto,
  RegisterBusinessDto,
  UpdateBusinessRulesDto,
  UpdateOrderStatusDto,
  UpsertCustomerDto,
} from './dto/business.dto';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireOwnedBusiness(userId: string) {
    const biz = await this.prisma.businessProfile.findUnique({ where: { ownerId: userId } });
    if (!biz) throw new NotFoundException('Register a business profile first');
    return biz;
  }

  async registerBusiness(userId: string, dto: RegisterBusinessDto) {
    return this.prisma.businessProfile.upsert({
      where: { ownerId: userId },
      update: {
        businessName: dto.businessName.trim(),
        category: dto.category.trim(),
        description: dto.description?.trim() ?? null,
      },
      create: {
        ownerId: userId,
        businessName: dto.businessName.trim(),
        category: dto.category.trim(),
        description: dto.description?.trim() ?? null,
      },
    });
  }

  async getMyBusiness(userId: string) {
    return this.requireOwnedBusiness(userId);
  }

  async requestVerification(userId: string) {
    const biz = await this.requireOwnedBusiness(userId);
    if (biz.verificationStatus === BusinessVerificationStatus.VERIFIED) {
      throw new BadRequestException('Business is already verified');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.businessProfile.update({
        where: { id: biz.id },
        data: { verificationStatus: BusinessVerificationStatus.PENDING },
      });
      await tx.approvalWorkflow.create({
        data: {
          workflowType: 'BUSINESS_VERIFICATION',
          targetId: biz.id,
          requestedById: userId,
          status: ApprovalStatus.PENDING,
          notes: `Verification requested for ${biz.businessName}`,
        },
      });
      return updated;
    });
  }

  async updateRules(userId: string, dto: UpdateBusinessRulesDto) {
    const biz = await this.requireOwnedBusiness(userId);
    return this.prisma.businessProfile.update({
      where: { id: biz.id },
      data: dto,
    });
  }

  async createProduct(userId: string, dto: CreateProductDto) {
    const biz = await this.requireOwnedBusiness(userId);
    return this.prisma.product.create({
      data: {
        businessId: biz.id,
        sku: dto.sku.trim().toUpperCase(),
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        priceCents: dto.priceCents,
        currency: dto.currency ?? 'USD',
        inStock: dto.inStock ?? true,
      },
    });
  }

  async listPublicCatalog(page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        include: {
          business: { select: { id: true, businessName: true, verificationStatus: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count(),
    ]);
    return buildPaginatedResponse(items, total, page, limit);
  }

  async toggleProductStock(userId: string, productId: string) {
    const biz = await this.requireOwnedBusiness(userId);
    const prod = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!prod || prod.businessId !== biz.id) throw new ForbiddenException('Not your product');
    return this.prisma.product.update({
      where: { id: prod.id },
      data: { inStock: !prod.inStock },
    });
  }

  async upsertCustomer(userId: string, dto: UpsertCustomerDto) {
    const biz = await this.requireOwnedBusiness(userId);
    return this.prisma.customerRecord.create({
      data: {
        businessId: biz.id,
        customerUserId: dto.customerUserId ?? null,
        customerName: dto.customerName.trim(),
        labels: dto.labels,
      },
    });
  }

  async listCustomers(userId: string) {
    const biz = await this.requireOwnedBusiness(userId);
    return this.prisma.customerRecord.findMany({
      where: { businessId: biz.id },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async addCustomerNote(userId: string, customerRecordId: string, dto: AddCustomerNoteDto) {
    const biz = await this.requireOwnedBusiness(userId);
    const rec = await this.prisma.customerRecord.findUnique({ where: { id: customerRecordId } });
    if (!rec || rec.businessId !== biz.id) throw new ForbiddenException('Customer record not found');
    return this.prisma.customerNote.create({
      data: {
        customerRecordId: rec.id,
        authorId: userId,
        note: dto.note.trim(),
      },
    });
  }

  async createQuickReply(userId: string, dto: CreateQuickReplyDto) {
    const biz = await this.requireOwnedBusiness(userId);
    return this.prisma.quickReply.upsert({
      where: { businessId_shortcut: { businessId: biz.id, shortcut: dto.shortcut.toLowerCase() } },
      update: { title: dto.title.trim(), body: dto.body.trim() },
      create: {
        businessId: biz.id,
        shortcut: dto.shortcut.toLowerCase(),
        title: dto.title.trim(),
        body: dto.body.trim(),
      },
    });
  }

  async listQuickReplies(userId: string) {
    const biz = await this.requireOwnedBusiness(userId);
    return this.prisma.quickReply.findMany({
      where: { businessId: biz.id },
      orderBy: { shortcut: 'asc' },
    });
  }

  async createOrderInquiry(customerId: string, dto: CreateOrderInquiryDto) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.inStock) throw new BadRequestException('Product is currently out of stock');

    const totalCents = dto.quantity * product.priceCents;

    return this.prisma.orderInquiry.create({
      data: {
        businessId: product.businessId,
        customerId,
        productId: product.id,
        quantity: dto.quantity,
        unitPriceCents: product.priceCents,
        totalCents,
        status: OrderStatus.PENDING,
        notes: dto.notes?.trim() ?? null,
      },
    });
  }

  async updateOrderStatus(userId: string, orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.orderInquiry.findUnique({
      where: { id: orderId },
      include: { business: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.business.ownerId !== userId && order.customerId !== userId) {
      throw new ForbiddenException('Not authorized to modify this order');
    }
    if (order.status === OrderStatus.FULFILLED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already in a terminal state');
    }
    if (
      order.customerId === userId &&
      order.business.ownerId !== userId &&
      dto.status !== OrderStatus.CANCELLED
    ) {
      throw new ForbiddenException('Customers may only cancel pending orders');
    }

    return this.prisma.orderInquiry.update({
      where: { id: order.id },
      data: { status: dto.status },
    });
  }

  async getAnalytics(userId: string) {
    const biz = await this.requireOwnedBusiness(userId);
    const [products, orders, customerCount] = await Promise.all([
      this.prisma.product.findMany({ where: { businessId: biz.id } }),
      this.prisma.orderInquiry.findMany({ where: { businessId: biz.id } }),
      this.prisma.customerRecord.count({ where: { businessId: biz.id } }),
    ]);

    const activeOrders = orders.filter((o) => o.status !== OrderStatus.CANCELLED);
    return {
      businessId: biz.id,
      verificationStatus: biz.verificationStatus,
      totalProducts: products.length,
      inStockProducts: products.filter((p) => p.inStock).length,
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === OrderStatus.PENDING).length,
      fulfilledOrders: orders.filter((o) => o.status === OrderStatus.FULFILLED).length,
      grossRevenueCents: activeOrders.reduce((acc, o) => acc + o.totalCents, 0),
      customerCount,
    };
  }
}
