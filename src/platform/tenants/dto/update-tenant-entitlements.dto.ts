import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CapabilityOverrideDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  capabilityKey!: string;

  @IsEnum(['allow', 'deny'], {
    message: "Effect must be either 'allow' or 'deny'",
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  effect!: 'allow' | 'deny';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class TenantAddonAssignmentDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  addonKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  credits!: number;

  @IsOptional()
  @IsBoolean()
  renews?: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  validUntil?: Date;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateTenantEntitlementsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CapabilityOverrideDto)
  overrides?: CapabilityOverrideDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CapabilityOverrideDto)
  entitlements?: CapabilityOverrideDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantAddonAssignmentDto)
  addons?: TenantAddonAssignmentDto[];
}
