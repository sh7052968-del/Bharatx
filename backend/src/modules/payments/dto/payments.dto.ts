import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ example: 'GROWTH_PRO' })
  @IsString()
  @Matches(/^[A-Z0-9_]{3,32}$/)
  code!: string;

  @ApiProperty({ example: 'Growth Pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  monthlyPriceCents!: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  features!: string[];
}

export class SubscribePlanDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}

export class RequestRefundDto {
  @ApiProperty()
  @IsUUID()
  transactionId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
