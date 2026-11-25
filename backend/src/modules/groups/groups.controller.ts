import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConversationMemberRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import {
  AddGroupMemberDto,
  CreateGroupDto,
  GroupAnnouncementDto,
  UpdateGroupPermissionsDto,
} from './dto/groups.dto';
import { GroupsService } from './groups.service';

@ApiTags('Groups')
@ApiBearerAuth()
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a group with underlying conversation and invite link' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group info and members' })
  get(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.groupsService.getGroup(userId, id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to the group' })
  addMember(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(userId, id, dto);
  }

  @Delete(':id/members/:targetUserId')
  @ApiOperation({ summary: 'Remove a member or leave group' })
  removeMember(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.groupsService.removeMember(userId, id, targetUserId);
  }

  @Put(':id/members/:targetUserId/role')
  @ApiOperation({ summary: 'Promote or demote group admin' })
  setRole(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
    @Body('role') role: ConversationMemberRole,
  ) {
    return this.groupsService.updateMemberRole(userId, id, targetUserId, role);
  }

  @Patch(':id/permissions')
  @ApiOperation({ summary: 'Update group governance permissions' })
  updatePermissions(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGroupPermissionsDto,
  ) {
    return this.groupsService.updatePermissions(userId, id, dto);
  }

  @Post(':id/invite/rotate')
  @ApiOperation({ summary: 'Rotate group invite link code' })
  rotateInvite(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.groupsService.rotateInviteLink(userId, id);
  }

  @Post('join/:inviteCode')
  @ApiOperation({ summary: 'Join a group using its invite link code' })
  join(@CurrentUser('userId') userId: string, @Param('inviteCode') inviteCode: string) {
    return this.groupsService.joinByInviteCode(userId, inviteCode);
  }

  @Post(':id/announcements')
  @ApiOperation({ summary: 'Publish pinned group announcement' })
  announce(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: GroupAnnouncementDto,
  ) {
    return this.groupsService.postAnnouncement(userId, id, dto);
  }
}
