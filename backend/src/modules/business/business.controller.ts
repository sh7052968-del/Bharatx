import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Idempotent } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BusinessService } from './business.service';
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

@ApiTags('Business')
@ApiBearerAuth()
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post('profile')
  @ApiOperation({ summary: 'Register or update business profile' })
  register(@CurrentUser('userId') userId: string, @Body() dto: RegisterBusinessDto) {
    return this.businessService.registerBusiness(userId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get owned business profile' })
  getProfile(@CurrentUser('userId') userId: string) {
    return this.businessService.getMyBusiness(userId);
  }

  @Post('verification/request')
  @ApiOperation({ summary: 'Submit business verification request to admin approval queue' })
  requestVerification(@CurrentUser('userId') userId: string) {
    return this.businessService.requestVerification(userId);
  }

  @Patch('rules')
  @ApiOperation({ summary: 'Configure greeting and away automation messages' })
  updateRules(@CurrentUser('userId') userId: string, @Body() dto: UpdateBusinessRulesDto) {
    return this.businessService.updateRules(userId, dto);
  }

  @Post('products')
  @ApiOperation({ summary: 'Add product to business catalog' })
  createProduct(@CurrentUser('userId') userId: string, @Body() dto: CreateProductDto) {
    return this.businessService.createProduct(userId, dto);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'List paginated public catalog products' })
  catalog(@Query() query: PaginationQueryDto) {
    return this.businessService.listPublicCatalog(query.page, query.limit);
  }

  @Patch('products/:id/stock')
  @ApiOperation({ summary: 'Toggle product stock availability' })
  toggleStock(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.businessService.toggleProductStock(userId, id);
  }

  @Post('customers')
  @ApiOperation({ summary: 'Add CRM customer with labels' })
  addCustomer(@CurrentUser('userId') userId: string, @Body() dto: UpsertCustomerDto) {
    return this.businessService.upsertCustomer(userId, dto);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List CRM customers and notes' })
  listCustomers(@CurrentUser('userId') userId: string) {
    return this.businessService.listCustomers(userId);
  }

  @Post('customers/:id/notes')
  @ApiOperation({ summary: 'Append CRM note for a customer' })
  addNote(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: AddCustomerNoteDto,
  ) {
    return this.businessService.addCustomerNote(userId, id, dto);
  }

  @Put('quick-replies')
  @ApiOperation({ summary: 'Create or update /shortcut quick reply' })
  upsertQuickReply(@CurrentUser('userId') userId: string, @Body() dto: CreateQuickReplyDto) {
    return this.businessService.createQuickReply(userId, dto);
  }

  @Get('quick-replies')
  @ApiOperation({ summary: 'List business quick replies' })
  listQuickReplies(@CurrentUser('userId') userId: string) {
    return this.businessService.listQuickReplies(userId);
  }

  @Post('orders')
  @Idempotent()
  @ApiOperation({ summary: 'Submit deterministic order inquiry (idempotent)' })
  createOrder(@CurrentUser('userId') userId: string, @Body() dto: CreateOrderInquiryDto) {
    return this.businessService.createOrderInquiry(userId, dto);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Update order inquiry lifecycle status' })
  updateOrder(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.businessService.updateOrderStatus(userId, id, dto);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get deterministic business analytics metrics' })
  analytics(@CurrentUser('userId') userId: string) {
    return this.businessService.getAnalytics(userId);
  }
}
