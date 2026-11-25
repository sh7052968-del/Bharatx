import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType, MessageType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ enum: ConversationType })
  @IsEnum(ConversationType)
  type!: ConversationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  memberIds!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @ApiPropertyOptional({ default: 0, description: '0 disables disappearing messages' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2592000)
  disappearingTtlSeconds?: number;
}

export class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  conversationId!: string;

  @ApiProperty({ enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  messageType: MessageType = MessageType.TEXT;

  @ApiPropertyOptional({ description: 'Opaque base64 E2EE ciphertext for encrypted conversations' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  ciphertext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  nonce?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  senderKeyVersion?: number;

  @ApiPropertyOptional({ description: 'Only permitted for non-E2EE conversations' })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  plaintextBody?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaMimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  mediaSizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  forwardedFromId?: string;
}

export class EditMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ciphertext?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nonce?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  plaintextBody?: string;
}

export class ReactMessageDto {
  @ApiProperty({ example: '👍' })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji!: string;
}

export class DisappearingSettingsDto {
  @ApiProperty({ description: 'Seconds until expiry; 0 to disable' })
  @IsInt()
  @Min(0)
  @Max(2592000)
  ttlSeconds!: number;
}
