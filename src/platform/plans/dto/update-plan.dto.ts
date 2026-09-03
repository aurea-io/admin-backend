import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PlanStatus } from '@prisma/client';
import { PlanPriceDto } from './plan-price.dto.js';
import { PlanCreditsDto } from './plan-credits.dto.js';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedFeatures?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanPriceDto)
  prices?: PlanPriceDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PlanCreditsDto)
  credits?: PlanCreditsDto;

  @IsOptional()
  @IsObject()
  limits?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
