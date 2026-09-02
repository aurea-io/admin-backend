import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  Matches,
  MinLength,
} from 'class-validator';
import { ModuleCatalogKind } from '@prisma/client';

const KEY_PATTERN_REGEX = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

export class CreateCatalogEntryDto {
  @IsString()
  @Matches(KEY_PATTERN_REGEX, {
    message: 'key must be a stable catalog key (e.g. "services.bookings.photo_upload")',
  })
  key!: string;

  @IsEnum(ModuleCatalogKind)
  kind!: ModuleCatalogKind;

  @IsString()
  @MinLength(2)
  moduleKey!: string;

  @IsString()
  @MinLength(2)
  sectionKey!: string;

  @IsOptional()
  @IsString()
  pageKey?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

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
