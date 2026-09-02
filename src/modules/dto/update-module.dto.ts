import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  MinLength,
} from 'class-validator';

export class UpdateModuleDto {
  @IsOptional()
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
