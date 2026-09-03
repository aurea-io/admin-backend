import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateModuleDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredPermissions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availablePlans?: string[];

  @IsOptional()
  @IsBoolean()
  requiresSubscription?: boolean;

  @IsOptional()
  @IsString()
  ownerTeam?: string;

  @IsOptional()
  @IsString()
  manifest?: string;
}
