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
import { TokenService } from './services/token.service.js';
import { GoogleAuthService } from './services/google-auth.service.js';
import { PlatformUserRepository } from './repositories/platform-user.repository.js';
import { RefreshSessionRepository } from './repositories/refresh-session.repository.js';
import {
  AUTH_CONFIG,
  AUTH_ENV_KEYS,
  AUTH_ERRORS,
} from './constants/auth.constants.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: AUTH_CONFIG.STRATEGY_JWT }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>(AUTH_ENV_KEYS.JWT_ACCESS_SECRET);
        if (!secret) {
          throw new Error(AUTH_ERRORS.JWT_SECRET_NOT_CONFIGURED);
        }
        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>(AUTH_ENV_KEYS.JWT_ACCESS_EXPIRES_IN) ||
              AUTH_CONFIG.DEFAULT_JWT_EXPIRES_IN) as any,
          },
        };
      },
      inject: [ConfigService],
    }),
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PlatformUserRepository,
    RefreshSessionRepository,
    TokenService,
    GoogleAuthService,
    JwtStrategy,
    PlatformJwtAuthGuard,
    PlatformPermissionsGuard,
  ],
  exports: [
    AuthService,
    PlatformUserRepository,
    TokenService,
    GoogleAuthService,
    JwtModule,
    PassportModule,
    PlatformJwtAuthGuard,
    PlatformPermissionsGuard,
  ],
})
export class AuthModule {}
