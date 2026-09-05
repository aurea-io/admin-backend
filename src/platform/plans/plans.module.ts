import { Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthModule } from '../../auth/auth.module.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { PlansRepository } from './plans.repository.js';
import { AuditService } from '../../audit/audit.service.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PlansController],
  providers: [PlansService, PlansRepository],
  exports: [PlansService, PlansRepository],
})
export class PlansModule implements OnModuleInit {
  constructor(
    private readonly auditService: AuditService,
    private readonly plansRepository: PlansRepository,
  ) {}

  onModuleInit() {
    this.auditService.registerEntityLoader('plans', (idOrKey: string) =>
      this.plansRepository.findByIdOrKey(idOrKey),
    );
  }
}


