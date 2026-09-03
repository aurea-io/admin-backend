import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PlanBillingInterval } from '@prisma/client';

export class PlanPriceDto {
  @IsString()
  @Length(3, 4)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  currency!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(PlanBillingInterval)
  interval!: PlanBillingInterval;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
