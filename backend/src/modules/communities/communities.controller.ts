import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CommunitiesService } from './communities.service';
import {
  CommunityAnnouncementDto,
  CreateCommunityDto,
  LinkGroupDto,
  UpdateCommunityModerationDto,
} from './dto/communities.dto';

@ApiTags('Communities')
@ApiBearerAuth()
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a community' })
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateCommunityDto) {
    return this.communitiesService.createCommunity(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List paginated communities for user' })
  list(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.communitiesService.listCommunities(userId, query.page, query.limit);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community' })
  join(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.communitiesService.joinCommunity(userId, id);
  }

  @Post(':id/groups')
  @ApiOperation({ summary: 'Link an existing group to a community' })
  linkGroup(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: LinkGroupDto,
  ) {
    return this.communitiesService.linkGroup(userId, id, dto.groupId);
  }

  @Post(':id/announcements')
  @ApiOperation({ summary: 'Publish community announcement' })
  announce(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CommunityAnnouncementDto,
  ) {
    return this.communitiesService.postAnnouncement(userId, id, dto);
  }

  @Get(':id/announcements')
  @ApiOperation({ summary: 'List community announcements' })
  listAnnouncements(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.communitiesService.listAnnouncements(userId, id);
  }

  @Put(':id/members/:targetUserId/moderation')
  @ApiOperation({ summary: 'Update community moderator role and permissions' })
  updateModeration(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: UpdateCommunityModerationDto,
  ) {
    return this.communitiesService.updateModeration(userId, id, targetUserId, dto);
  }
}
