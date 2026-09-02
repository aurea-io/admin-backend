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

    // If no specific features are required on this route, allow access
    if (!requiredFeatures || requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const jwtUser = request['user'] as PlatformJwtPayload | undefined;

    if (!jwtUser || !jwtUser.sub) {
      throw new UnauthorizedException('Access denied: platform user is not authenticated');
    }

    // Query active state from MongoDB
    const user = await this.prisma.platformUser.findUnique({
      where: { id: jwtUser.sub },
      select: { role: true, allowedFeatures: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Platform user is inactive or not found');
    }

    // Business rule: platform_owner always has full unrestricted access
    if (user.role === PlatformRole.platform_owner) {
      return true;
    }

    // Business rule: platform_operator requires granular allowedFeatures match
    if (user.role === PlatformRole.platform_operator) {
      const hasAllFeatures = requiredFeatures.every((feature) =>
        user.allowedFeatures.includes(feature),
      );

      if (!hasAllFeatures) {
        throw new ForbiddenException(
          `Access denied: insufficient platform permissions for [${requiredFeatures.join(', ')}]`,
        );
      }

      return true;
    }

    throw new ForbiddenException('Unauthorized user role on platform');
  }
}
