import { Module, Global } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditRepository } from './audit.repository.js';
import { AuditInterceptor } from './interceptors/audit.interceptor.js';

@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, AuditInterceptor],
  exports: [AuditService, AuditRepository, AuditInterceptor],
})
export class AuditModule {}
