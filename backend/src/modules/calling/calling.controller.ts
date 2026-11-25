import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CallingService } from './calling.service';
import { InitiateCallDto } from './dto/calling.dto';

@ApiTags('Calling')
@ApiBearerAuth()
@Controller('calling')
export class CallingController {
  constructor(private readonly callingService: CallingService) {}

  @Get('ice-servers')
  @ApiOperation({ summary: 'Get STUN/TURN WebRTC ICE server configuration with ephemeral TURN credentials' })
  iceServers(@CurrentUser('userId') userId: string) {
    return this.callingService.getIceServers(userId);
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Initiate voice, video, or group call invitation' })
  initiate(@CurrentUser('userId') userId: string, @Body() dto: InitiateCallDto) {
    return this.callingService.initiateCall(userId, dto);
  }

  @Post('sessions/:id/accept')
  @ApiOperation({ summary: 'Accept an incoming call' })
  accept(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.callingService.acceptCall(userId, id);
  }

  @Post('sessions/:id/end')
  @ApiOperation({ summary: 'End or cancel a call session and compute duration' })
  end(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.callingService.endCall(userId, id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get paginated call history for current user' })
  history(@CurrentUser('userId') userId: string, @Query() query: PaginationQueryDto) {
    return this.callingService.listHistory(userId, query.page, query.limit);
  }
}
