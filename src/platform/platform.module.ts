import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PlatformController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';

import { PlatformCatalogModule } from './catalog/platform-catalog.module.js';

@Module({
  imports: [PrismaModule, AuthModule, PlatformCatalogModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformCatalogModule],
})
export class PlatformModule {}
