import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ModulesController } from './modules.controller.js';
import { ModulesService } from './modules.service.js';
import { ModulesRepository } from './modules.repository.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ModulesController],
  providers: [ModulesService, ModulesRepository],
  exports: [ModulesService, ModulesRepository],
})
export class ModulesModule {}
