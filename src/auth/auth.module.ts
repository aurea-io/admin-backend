import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from './guards/platform-permissions.guard.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'default-platform-jwt-secret',
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRES_IN') || '1h') as any,
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PlatformJwtAuthGuard,
    PlatformPermissionsGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    PlatformJwtAuthGuard,
    PlatformPermissionsGuard,
  ],
})
export class AuthModule {}
