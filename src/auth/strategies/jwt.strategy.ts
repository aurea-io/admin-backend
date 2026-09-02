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
    const secret = config.get<string>('JWT_ACCESS_SECRET') || 'default-platform-jwt-secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: PlatformJwtPayload): Promise<PlatformJwtPayload> {
    if (!payload.sub || !payload.email || payload.scope !== 'platform') {
      throw new UnauthorizedException('Token de plataforma inválido o de scope incorrecto');
    }

    // Backend es la fuente de verdad: validación en tiempo real contra MongoDB
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
      throw new UnauthorizedException('Usuario de plataforma inactivo o no encontrado');
    }

    // Revocación instantánea por tokenVersion (por cambio de password o reseteo de sesiones)
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('La sesión ha sido revocada o ha expirado');
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
