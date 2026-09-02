import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsString,
  IsDateString,
} from 'class-validator';
import { ModuleCatalogStatus } from '@prisma/client';

export class UpdateModuleStatusDto {
  @IsEnum(ModuleCatalogStatus)
  status!: ModuleCatalogStatus;

  @IsOptional()
  @IsBoolean()
  maintenanceEnabled?: boolean;

  @IsOptional()
  @IsString()
  maintenanceMessage?: string;

  @IsOptional()
  @IsDateString()
  maintenanceStartsAt?: string;

  @IsOptional()
  @IsDateString()
  maintenanceEndsAt?: string;
}
