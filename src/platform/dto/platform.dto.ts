import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTenantDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(2) slug!: string;
  @IsString() @MinLength(2) vertical!: string;
}

export class UpdateTenantDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(2) vertical?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsString() maintenanceMessage?: string;
}

