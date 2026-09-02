import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PlatformJwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET must be configured in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformJwtPayload> {
    if (!payload.sub || !payload.email || payload.scope !== 'platform') {
      throw new UnauthorizedException('Invalid platform token or invalid token scope');
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
      throw new UnauthorizedException('Platform user is inactive or not found');
    }

    // Instant session revocation via tokenVersion comparison
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Session has been revoked or expired');
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
      scope: 'platform',
    };
  }
}
