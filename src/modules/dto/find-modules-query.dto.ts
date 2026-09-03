import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ModuleCatalogKind, ModuleCatalogStatus } from '@prisma/client';

export class FindModulesQueryDto {
  @IsOptional()
  @IsEnum(ModuleCatalogKind)
  kind?: ModuleCatalogKind;

  @IsOptional()
  @IsEnum(ModuleCatalogStatus)
  status?: ModuleCatalogStatus;

  @IsOptional()
  @IsString()
  sectionKey?: string;
}
