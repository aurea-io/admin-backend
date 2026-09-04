import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PlanStatus } from '@prisma/client';

export class FindPlansQueryDto {
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeArchived?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  sortBy?: 'displayOrder' | 'name' | 'createdAt' | 'key' | 'status';

  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  sortOrder?: 'asc' | 'desc';
}
