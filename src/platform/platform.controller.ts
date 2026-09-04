import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../auth/decorators/require-features.decorator.js';
import { PlatformService } from './platform.service.js';

@Controller('platform')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('features')
  @RequireFeatures('platform.features.read')
  listFeatures() {
    return this.platform.listFeatures();
  }
}


