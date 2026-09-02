import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PlatformJwtPayload } from '../interfaces/jwt-payload.interface.js';
import {
  AUTH_CONFIG,
  AUTH_ENV_KEYS,
  AUTH_ERRORS,
} from '../constants/auth.constants.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, AUTH_CONFIG.STRATEGY_JWT) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>(AUTH_ENV_KEYS.JWT_ACCESS_SECRET);
    if (!secret) {
      throw new Error(AUTH_ERRORS.JWT_SECRET_NOT_CONFIGURED);
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformJwtPayload> {
    if (!payload.sub || !payload.email || payload.scope !== AUTH_CONFIG.PLATFORM_SCOPE) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN_SCOPE);
    }

    // Backend is the source of truth: real-time validation against MongoDB
    const user = await this.prisma.platformUser.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        allowedFeatures: true,
        isActive: true,
        tokenVersion: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_INACTIVE_OR_NOT_FOUND);
    }

    // Instant session revocation via tokenVersion comparison
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(AUTH_ERRORS.SESSION_REVOKED);
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
      scope: AUTH_CONFIG.PLATFORM_SCOPE,
    };
  }
}
