import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { PlatformCatalogController } from './platform-catalog.controller.js';
import { PlatformCatalogService } from './platform-catalog.service.js';
import { PlatformCatalogRepository } from './platform-catalog.repository.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PlatformCatalogController],
  providers: [PlatformCatalogService, PlatformCatalogRepository],
  exports: [PlatformCatalogService, PlatformCatalogRepository],
})
export class PlatformCatalogModule {}
