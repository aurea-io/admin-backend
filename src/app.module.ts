import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { HealthModule } from './health/health.module.js';
import { ModulesModule } from './modules/modules.module.js';
import { AuditModule } from './audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    PlatformModule,
    HealthModule,
    ModulesModule,
    AuditModule,
  ],
})
export class AppModule {}
