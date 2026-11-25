import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  AddContactDto,
  BlockUserDto,
  RegisterKeyBundleDto,
  ReportUserDto,
  UpdatePresenceDto,
  UpdatePrivacyDto,
  UpdateProfileDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  getMe(@CurrentUser('userId') userId: string) {
    return this.usersService.getMe(userId);
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update profile display name, username, and department' })
  updateProfile(@CurrentUser('userId') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload validated profile picture' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadAvatar(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: { mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }

  @Patch('me/privacy')
  @ApiOperation({ summary: 'Update privacy preferences (last seen, avatar, read receipts)' })
  updatePrivacy(@CurrentUser('userId') userId: string, @Body() dto: UpdatePrivacyDto) {
    return this.usersService.updatePrivacy(userId, dto);
  }

  @Patch('me/presence')
  @ApiOperation({ summary: 'Update online presence status' })
  updatePresence(@CurrentUser('userId') userId: string, @Body() dto: UpdatePresenceDto) {
    return this.usersService.updatePresence(userId, dto);
  }

  @Put('me/keys')
  @ApiOperation({ summary: 'Register E2EE identity and signed prekey bundle' })
  registerKeys(@CurrentUser('userId') userId: string, @Body() dto: RegisterKeyBundleDto) {
    return this.usersService.registerKeyBundle(userId, dto);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'List paginated user contacts' })
  listContacts(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.usersService.listContacts(userId, query.page, query.limit);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Add a user to contacts' })
  addContact(@CurrentUser('userId') userId: string, @Body() dto: AddContactDto) {
    return this.usersService.addContact(userId, dto);
  }

  @Delete('contacts/:contactId')
  @ApiOperation({ summary: 'Remove a contact' })
  removeContact(@CurrentUser('userId') userId: string, @Param('contactId') contactId: string) {
    return this.usersService.removeContact(userId, contactId);
  }

  @Get('blocks')
  @ApiOperation({ summary: 'List blocked users' })
  listBlocks(@CurrentUser('userId') userId: string) {
    return this.usersService.listBlocked(userId);
  }

  @Post('blocks')
  @ApiOperation({ summary: 'Block a user' })
  blockUser(@CurrentUser('userId') userId: string, @Body() dto: BlockUserDto) {
    return this.usersService.blockUser(userId, dto);
  }

  @Delete('blocks/:blockedId')
  @ApiOperation({ summary: 'Unblock a user' })
  unblockUser(@CurrentUser('userId') userId: string, @Param('blockedId') blockedId: string) {
    return this.usersService.unblockUser(userId, blockedId);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Report an abusive user' })
  reportUser(@CurrentUser('userId') userId: string, @Body() dto: ReportUserDto) {
    return this.usersService.reportUser(userId, dto);
  }

  @Get(':userId/keys')
  @ApiOperation({ summary: 'Fetch target user public key bundles for E2EE session setup' })
  getKeys(@Param('userId') targetUserId: string) {
    return this.usersService.getKeyBundles(targetUserId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Fetch user public profile respecting privacy rules' })
  getPublicProfile(@CurrentUser('userId') viewerId: string, @Param('userId') targetUserId: string) {
    return this.usersService.getPublicProfile(viewerId, targetUserId);
  }
}
