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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  CreateConversationDto,
  DisappearingSettingsDto,
  EditMessageDto,
  ReactMessageDto,
  SendMessageDto,
} from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Create a private, group, or support conversation' })
  createConversation(@CurrentUser('userId') userId: string, @Body() dto: CreateConversationDto) {
    return this.messagingService.createConversation(userId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List paginated conversations where user is a participant' })
  listConversations(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.messagingService.listConversations(userId, query.page, query.limit);
  }

  @Patch('conversations/:id/disappearing')
  @ApiOperation({ summary: 'Configure disappearing message TTL in seconds' })
  setDisappearing(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: DisappearingSettingsDto,
  ) {
    return this.messagingService.setDisappearingMessages(userId, id, dto);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a text, E2EE encrypted, media, reply, or forwarded message' })
  sendMessage(@CurrentUser('userId') userId: string, @Body() dto: SendMessageDto) {
    return this.messagingService.sendMessage(userId, dto);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List paginated messages for a conversation' })
  listMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.messagingService.listMessages(userId, id, query.page, query.limit);
  }

  @Get('conversations/:id/search')
  @ApiOperation({ summary: 'Search messages inside a non-E2EE conversation' })
  searchMessages(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Query('q') q: string,
  ) {
    return this.messagingService.searchMessages(userId, id, q || '');
  }

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Edit own message' })
  editMessage(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagingService.editMessage(userId, id, dto);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Soft-delete and wipe message content' })
  deleteMessage(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.messagingService.deleteMessage(userId, id);
  }

  @Post('messages/:id/reactions')
  @ApiOperation({ summary: 'Toggle emoji reaction on a message' })
  react(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: ReactMessageDto,
  ) {
    return this.messagingService.toggleReaction(userId, id, dto);
  }

  @Put('messages/:id/delivered')
  @ApiOperation({ summary: 'Record delivery receipt' })
  markDelivered(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.messagingService.markDelivered(userId, id);
  }

  @Put('messages/:id/read')
  @ApiOperation({ summary: 'Record read receipt respecting privacy preferences' })
  markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.messagingService.markRead(userId, id);
  }

  @Patch('messages/:id/pin')
  @ApiOperation({ summary: 'Pin or unpin a message' })
  togglePin(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.messagingService.togglePin(userId, id);
  }

  @Patch('messages/:id/star')
  @ApiOperation({ summary: 'Star or unstar a message' })
  toggleStar(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.messagingService.toggleStar(userId, id);
  }

  @Get('starred')
  @ApiOperation({ summary: 'List starred messages for current user' })
  listStarred(@CurrentUser('userId') userId: string) {
    return this.messagingService.listStarred(userId);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload validated image, video, audio, or PDF attachment' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadMedia(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: { mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.messagingService.uploadMedia(userId, file);
  }

  @Get('files/:fileName')
  @ApiOperation({ summary: 'Download a validated uploaded attachment' })
  downloadMedia(@Param('fileName') fileName: string, @Res() res: Response) {
    const filePath = this.messagingService.streamValidatedFile(fileName);
    res.sendFile(filePath);
  }
}
