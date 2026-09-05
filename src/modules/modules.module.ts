import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ModulesController } from './modules.controller.js';
import { ModulesService } from './modules.service.js';
import { ModulesRepository } from './modules.repository.js';
import { AuditService } from '../audit/audit.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ModulesController],
  providers: [ModulesService, ModulesRepository],
  exports: [ModulesService, ModulesRepository],
})
export class ModulesModule implements OnModuleInit {
  constructor(
    private readonly auditService: AuditService,
    private readonly modulesRepository: ModulesRepository,
  ) {}

  onModuleInit() {
    this.auditService.registerEntityLoader('modules', (key: string) =>
      this.modulesRepository.findByKey(key),
    );
  }
}

