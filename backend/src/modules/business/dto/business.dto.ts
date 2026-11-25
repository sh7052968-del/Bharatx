import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterBusinessDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateBusinessRulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  greetingEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  greetingText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  awayEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  awayText?: string;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,40}$/)
  sku!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  inStock?: boolean;
}

export class UpsertCustomerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerUserId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  customerName!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  labels!: string[];
}

export class AddCustomerNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}

export class CreateQuickReplyDto {
  @ApiProperty({ example: '/pricing' })
  @IsString()
  @Matches(/^\/[a-zA-Z0-9_-]{1,30}$/)
  shortcut!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  body!: string;
}

export class CreateOrderInquiryDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
