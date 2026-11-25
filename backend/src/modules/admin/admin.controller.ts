import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BusinessVerificationStatus, UserRole } from '@prisma/client';
import { Request } from 'express';
import {
  CurrentUser,
  RequirePermissions,
  Roles,
} from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdminOperationsService } from './admin-operations.service';
import { AdminService } from './admin.service';
import {
  AdminUsersQueryDto,
  BroadcastCampaignDto,
  CreateAdminAccountDto,
  CreateCustomRoleDto,
  CreateRefundRequestDto,
  CreateReleaseDto,
  ModerateProductDto,
  ModerationDecisionDto,
  RestrictBusinessDto,
  ReviewApprovalDto,
  RollbackFeatureConfigDto,
  UpdateAdminAccountDto,
  UpdateCustomRoleDto,
  UpdateFeatureFlagDto,
  UpdateFeatureModuleDto,
  UpdateSystemSettingsDto,
  UpdateUserGovernanceDto,
  UpsertNotificationTemplateDto,
  UpsertSubscriptionPlanDto,
  UserModerationActionDto,
  VerifyBusinessDto,
} from './dto/admin.dto';

const ALL_ADMIN_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_ADMIN,
  UserRole.BUSINESS_ADMIN,
  UserRole.FINANCE_ADMIN,
  UserRole.CONTENT_MODERATOR,
  UserRole.SUPPORT_ADMIN,
  UserRole.CUSTOM_ADMIN,
  UserRole.DEPT_ADMIN,
  UserRole.BUSINESS_MANAGER,
  UserRole.AGENT,
];

@ApiTags('Administration')
@ApiBearerAuth()
@Roles(...ALL_ADMIN_ROLES)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminOps: AdminOperationsService,
  ) {}

  // ---- A. OVERVIEW ----
  @Get('overview')
  @RequirePermissions('overview:read')
  @ApiOperation({ summary: 'Aggregate overview metrics (zero E2EE private message exposure)' })
  overview() {
    return this.adminService.getOverview();
  }

  // ---- B. USER MANAGEMENT ----
  @Get('users')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List & search users with role/status filters (zero E2EE key exposure)' })
  listUsers(
    @CurrentUser('role') role: UserRole,
    @CurrentUser('userId') actorId: string,
    @Query() query: AdminUsersQueryDto,
  ) {
    return this.adminService.listUsersFiltered(role, actorId, query);
  }

  @Patch('users/:id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Update user role, department, custom role, or suspension state' })
  updateUser(
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Body() dto: UpdateUserGovernanceDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateUserGovernance(actorId, actorRole, id, dto, req.ip);
  }

  @Post('users/:id/action')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Verify, suspend, ban, or restore user account' })
  userAction(
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Body() dto: UserModerationActionDto,
    @Req() req: Request,
  ) {
    return this.adminService.performUserModerationAction(actorId, actorRole, id, dto, req.ip);
  }

  // ---- C. ADMIN MANAGEMENT ----
  @Get('admins')
  @RequirePermissions('admins:read')
  @ApiOperation({ summary: 'List all administrators and active access restrictions' })
  listAdmins() {
    return this.adminService.listAdmins();
  }

  @Post('admins')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Provision a new administrator account with RBAC role (Super Admin only)' })
  createAdmin(
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Body() dto: CreateAdminAccountDto,
    @Req() req: Request,
  ) {
    return this.adminService.createAdminAccount(actorId, actorRole, dto, req.ip);
  }

  @Patch('admins/:id')
  @RequirePermissions('admins:write')
  @ApiOperation({ summary: 'Edit administrator role, department, or active access restriction' })
  updateAdmin(
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Body() dto: UpdateAdminAccountDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateAdminAccount(actorId, actorRole, id, dto, req.ip);
  }

  @Delete('admins/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke administrator privileges and active admin sessions (Super Admin only)' })
  removeAdmin(
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminService.removeAdminAccount(actorId, actorRole, id, req.ip);
  }

  @Get('admins/login-history')
  @RequirePermissions('admins:read')
  @ApiOperation({ summary: 'Inspect administrator login & session history' })
  adminLoginHistory() {
    return this.adminService.listAdminLoginHistory();
  }

  // ---- D. ROLE & PERMISSION CENTER ----
  @Post('roles')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a custom admin role with granular module permissions' })
  createRole(
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateCustomRoleDto,
    @Req() req: Request,
  ) {
    return this.adminService.createCustomRole(actorId, dto, req.ip);
  }

  @Patch('roles/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Edit custom admin role permissions' })
  updateRole(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomRoleDto,
    @Req() req: Request,
  ) {
    return this.adminService.updateCustomRole(actorId, id, dto, req.ip);
  }

  @Delete('roles/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete custom admin role' })
  deleteRole(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminService.deleteCustomRole(actorId, id, req.ip);
  }

  @Get('roles')
  @ApiOperation({ summary: 'List custom admin roles' })
  listRoles() {
    return this.adminService.listCustomRoles();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List granular module-level permission catalog' })
  listPermissions() {
    return this.adminService.listPermissionCatalog();
  }

  // ---- E. FEATURE CONTROL CENTER ----
  @Get('features')
  @RequirePermissions('features:read')
  @ApiOperation({ summary: 'Inspect feature modules, flags, dependencies, and config snapshot history' })
  getFeatureControl() {
    return this.adminOps.getFeatureControlState();
  }

  @Put('features/modules/:key')
  @RequirePermissions('features:write')
  @ApiOperation({ summary: 'Enable/disable module, update version, settings, or dependencies' })
  updateFeatureModule(
    @CurrentUser('userId') actorId: string,
    @Param('key') key: string,
    @Body() dto: UpdateFeatureModuleDto,
    @Req() req: Request,
  ) {
    return this.adminOps.updateFeatureModule(actorId, key, dto, req.ip);
  }

  @Put('features/flags/:key')
  @RequirePermissions('features:write')
  @ApiOperation({ summary: 'Update feature flag state, rollout percentage, and eligibility rules' })
  updateFeatureFlag(
    @CurrentUser('userId') actorId: string,
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
    @Req() req: Request,
  ) {
    return this.adminOps.updateFeatureFlag(actorId, key, dto, req.ip);
  }

  @Post('features/rollback')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Roll back feature module or flag to a previous configuration snapshot' })
  rollbackFeature(
    @CurrentUser('userId') actorId: string,
    @Body() dto: RollbackFeatureConfigDto,
    @Req() req: Request,
  ) {
    return this.adminOps.rollbackFeatureConfig(actorId, dto, req.ip);
  }

  // ---- F. BUSINESS MANAGEMENT ----
  @Get('businesses')
  @RequirePermissions('business:read')
  @ApiOperation({ summary: 'List business accounts and verification states' })
  listBusinesses(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: BusinessVerificationStatus,
  ) {
    return this.adminOps.listBusinessesFiltered(query.page, query.limit, status);
  }

  @Post('businesses/:id/verify')
  @RequirePermissions('business:approve')
  @ApiOperation({ summary: 'Approve or reject business verification' })
  verifyBusiness(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: VerifyBusinessDto,
    @Req() req: Request,
  ) {
    return this.adminOps.verifyBusiness(actorId, id, dto, req.ip);
  }

  @Patch('businesses/:id/restrict')
  @RequirePermissions('business:write')
  @ApiOperation({ summary: 'Restrict or unrestrict a business account' })
  restrictBusiness(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: RestrictBusinessDto,
    @Req() req: Request,
  ) {
    return this.adminOps.restrictBusiness(actorId, id, dto, req.ip);
  }

  @Get('businesses/:id/catalog')
  @RequirePermissions('business:read')
  @ApiOperation({ summary: 'List catalog products for a business' })
  businessCatalog(@Param('id') id: string) {
    return this.adminOps.listBusinessCatalog(id);
  }

  @Patch('businesses/:id/catalog/:productId')
  @RequirePermissions('business:write')
  @ApiOperation({ summary: 'Moderate catalog item availability' })
  moderateCatalogProduct(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() dto: ModerateProductDto,
    @Req() req: Request,
  ) {
    return this.adminOps.moderateBusinessProduct(actorId, id, productId, dto, req.ip);
  }

  // ---- G. CONTENT MODERATION ----
  @Get('moderation/reports')
  @RequirePermissions('moderation:read')
  @ApiOperation({ summary: 'Review user, group, and business abuse reports' })
  listReports(@Query('status') status?: string, @Query('targetType') targetType?: string) {
    return this.adminOps.listModerationReports(status, targetType);
  }

  @Post('moderation/reports/:id/decision')
  @RequirePermissions('moderation:write')
  @ApiOperation({ summary: 'Execute moderation decision and log audit trail' })
  decideReport(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Body() dto: ModerationDecisionDto,
    @Req() req: Request,
  ) {
    return this.adminOps.decideModerationReport(actorId, id, dto, req.ip);
  }

  // ---- H. FINANCE ----
  @Get('finance/overview')
  @RequirePermissions('finance:read')
  @ApiOperation({ summary: 'Inspect subscription plans, transactions, invoices, refunds, and revenue totals' })
  financeOverview() {
    return this.adminOps.getFinanceOverview();
  }

  @Put('finance/plans')
  @RequirePermissions('finance:write')
  @ApiOperation({ summary: 'Create or update a subscription plan tier' })
  upsertPlan(
    @CurrentUser('userId') actorId: string,
    @Body() dto: UpsertSubscriptionPlanDto,
    @Req() req: Request,
  ) {
    return this.adminOps.upsertSubscriptionPlan(actorId, dto, req.ip);
  }

  @Post('finance/refunds')
  @RequirePermissions('finance:write')
  @ApiOperation({ summary: 'Submit a refund request into the dual-approval workflow' })
  requestRefund(
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateRefundRequestDto,
    @Req() req: Request,
  ) {
    return this.adminOps.createRefundApprovalWorkflow(actorId, dto, req.ip);
  }

  // ---- I. NOTIFICATIONS ----
  @Get('notifications')
  @RequirePermissions('notifications:read')
  @ApiOperation({ summary: 'List announcements, notification templates, and recent campaign records' })
  notificationCenter() {
    return this.adminOps.listNotificationCenter();
  }

  @Put('notifications/templates')
  @RequirePermissions('notifications:write')
  @ApiOperation({ summary: 'Create or update a notification template' })
  upsertTemplate(
    @CurrentUser('userId') actorId: string,
    @Body() dto: UpsertNotificationTemplateDto,
    @Req() req: Request,
  ) {
    return this.adminOps.upsertNotificationTemplate(actorId, dto, req.ip);
  }

  @Post('notifications/campaigns')
  @RequirePermissions('notifications:write')
  @ApiOperation({ summary: 'Dispatch an operational notification campaign across RabbitMQ/WebPush/Email' })
  dispatchCampaign(
    @CurrentUser('userId') actorId: string,
    @Body() dto: BroadcastCampaignDto,
    @Req() req: Request,
  ) {
    return this.adminOps.dispatchNotificationCampaign(actorId, dto, req.ip);
  }

  // ---- J. ANALYTICS ----
  @Get('analytics')
  @RequirePermissions('analytics:read')
  @ApiOperation({ summary: 'Deterministic platform growth, volume, subscription, and storage analytics' })
  analytics() {
    return this.adminOps.getAnalyticsReport();
  }

  @Get('analytics/export.csv')
  @RequirePermissions('analytics:export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="connectx-analytics.csv"')
  @ApiOperation({ summary: 'Export deterministic platform analytics as CSV' })
  exportAnalyticsCsv(@CurrentUser('userId') actorId: string, @Req() req: Request) {
    return this.adminOps.exportAnalyticsCsv(actorId, req.ip);
  }

  // ---- K. SYSTEM SETTINGS ----
  @Get('settings')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Read ConnectX branding, localization, privacy, notification, and maintenance settings' })
  getSettings() {
    return this.adminOps.getSystemSettings();
  }

  @Put('settings')
  @RequirePermissions('settings:write')
  @ApiOperation({ summary: 'Update ConnectX global branding, privacy, notification, or maintenance settings' })
  updateSettings(
    @CurrentUser('userId') actorId: string,
    @Body() dto: UpdateSystemSettingsDto,
    @Req() req: Request,
  ) {
    return this.adminOps.updateSystemSettings(actorId, dto, req.ip);
  }

  // ---- L. APPROVALS & AUDIT CENTER ----
  @Get('approvals')
  @ApiOperation({ summary: 'List pending and historical approval workflows' })
  listApprovals(@Query() query: PaginationQueryDto) {
    return this.adminService.listApprovals(query.page, query.limit);
  }

  @Post('approvals/:id/review')
  @RequirePermissions('approvals:review')
  @ApiOperation({ summary: 'Approve or reject sensitive operation workflow (business verification, refund, release)' })
  reviewApproval(
    @CurrentUser('userId') actorId: string,
    @CurrentUser('role') actorRole: UserRole,
    @Param('id') id: string,
    @Body() dto: ReviewApprovalDto,
    @Req() req: Request,
  ) {
    return this.adminService.reviewApproval(actorId, actorRole, id, dto, req.ip);
  }

  @Get('audit-logs')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'List paginated tamper-evident SHA-256 chained audit logs' })
  auditLogs(
    @Query() query: PaginationQueryDto,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listAuditLogs(query.page, query.limit, category, search);
  }

  // ---- M. DEVELOPER CONTROL CENTER ----
  @Get('developer/overview')
  @RequirePermissions('developer:read')
  @ApiOperation({ summary: 'Inspect module versions, background queues, API health, staging/production releases, and backups' })
  developerOverview() {
    return this.adminOps.getDeveloperOverview();
  }

  @Post('developer/releases')
  @RequirePermissions('developer:write')
  @ApiOperation({ summary: 'Register a controlled versioned code release in STAGING (zero runtime code eval)' })
  createRelease(
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateReleaseDto,
    @Req() req: Request,
  ) {
    return this.adminOps.createStagingRelease(actorId, dto, req.ip);
  }

  @Post('developer/releases/:id/request-production')
  @RequirePermissions('developer:write')
  @ApiOperation({ summary: 'Submit staging release for Super Admin production approval' })
  requestPromotion(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminOps.requestProductionPromotion(actorId, id, req.ip);
  }

  @Post('developer/releases/:id/rollback')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Roll back a release pointer cleanly (Super Admin only)' })
  rollbackRelease(
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.adminOps.rollbackRelease(actorId, id, req.ip);
  }
}
