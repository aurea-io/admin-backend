import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REQUIRE_FEATURES_KEY } from '../decorators/require-features.decorator.js';
import type { Request } from 'express';
import type { PlatformJwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_FEATURES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si no se exigen features específicas en la ruta, se permite continuar
    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const jwtUser = request['user'] as PlatformJwtPayload | undefined;

    if (!jwtUser || !jwtUser.sub) {
      throw new UnauthorizedException('Acceso denegado: usuario de plataforma no autenticado');
    }

    // Consultamos el estado real y vigente en MongoDB
    const user = await this.prisma.platformUser.findUnique({
      where: { id: jwtUser.sub },
      select: { role: true, allowedFeatures: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario de plataforma inactivo o no encontrado');
    }

    // Regla de Negocio: platform_owner tiene acceso total e irrestricto siempre
    if (user.role === PlatformRole.platform_owner) {
      return true;
    }

    // Regla de Negocio: platform_operator requiere validación granular sobre allowedFeatures
    if (user.role === PlatformRole.platform_operator) {
      const hasAllFeatures = requiredFeatures.every((feature) =>
        user.allowedFeatures.includes(feature),
      );

      if (!hasAllFeatures) {
        throw new ForbiddenException(
          `Acceso denegado: permisos de plataforma insuficientes para [${requiredFeatures.join(', ')}]`,
        );
      }

      return true;
    }

    throw new ForbiddenException('Rol de usuario no autorizado en plataforma');
  }
}
