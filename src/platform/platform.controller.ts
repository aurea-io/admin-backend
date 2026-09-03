import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../auth/decorators/require-features.decorator.js';
import { PlatformService } from './platform.service.js';
import { CreateTenantDto, UpdateTenantDto } from './dto/platform.dto.js';

@Controller('platform')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  @RequireFeatures('platform.tenants.read')
  listTenants() { return this.platform.listTenants(); }

  @Get('tenants/:id')
  @RequireFeatures('platform.tenants.read')
  getTenant(@Param('id') id: string) { return this.platform.getTenant(id); }

  @Post('tenants')
  @RequireFeatures('platform.tenants.write')
  createTenant(@Body() dto: CreateTenantDto) { return this.platform.createTenant(dto); }

  @Patch('tenants/:id')
  @RequireFeatures('platform.tenants.write')
  updateTenant(@Param('id') id: string, @Body() dto: UpdateTenantDto) { return this.platform.updateTenant(id, dto); }

  @Get('features')
  @RequireFeatures('platform.features.read')
  listFeatures() { return this.platform.listFeatures(); }
}

