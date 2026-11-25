import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class InitiateCallDto {
  @ApiProperty({ enum: CallType })
  @IsEnum(CallType)
  callType!: CallType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  inviteeIds!: string[];
}
