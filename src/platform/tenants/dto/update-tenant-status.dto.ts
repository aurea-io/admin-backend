import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateTenantStatusDto {
  @IsOptional()
  @IsEnum(['active', 'suspended'], {
    message: 'Status must be either active or suspended',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  status?: 'active' | 'suspended';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'boolean' ? value : value === 'true'))
  @IsBoolean()
  isActive?: boolean;
}
