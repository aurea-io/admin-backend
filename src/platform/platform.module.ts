import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PlatformController } from './platform.controller.js';
import { PlatformService } from './platform.service.js';
import { PlansModule } from './plans/plans.module.js';
import { TenantsModule } from './tenants/tenants.module.js';

@Module({
  imports: [PrismaModule, AuthModule, PlansModule, TenantsModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlansModule, TenantsModule],
})
export class PlatformModule {}


