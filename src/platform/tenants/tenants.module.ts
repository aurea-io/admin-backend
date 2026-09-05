import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';
import { TenantsRepository } from './tenants.repository.js';
import { AuditService } from '../../audit/audit.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantsRepository],
  exports: [TenantsService, TenantsRepository],
})
export class TenantsModule implements OnModuleInit {
  constructor(
    private readonly auditService: AuditService,
    private readonly tenantsRepository: TenantsRepository,
  ) {}

  onModuleInit() {
    this.auditService.registerEntityLoader('tenants', (idOrSlug: string) =>
      this.tenantsRepository.findByIdOrSlug(idOrSlug),
    );
  }
}

