import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { REQUIRE_FEATURES_KEY } from '../decorators/require-features.decorator.js';
import { AUTH_ERRORS } from '../constants/auth.constants.js';
import { PlatformUserRepository } from '../repositories/platform-user.repository.js';
import type { Request } from 'express';
import type { PlatformJwtPayload } from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly platformUserRepository: PlatformUserRepository,
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
      throw new UnauthorizedException(AUTH_ERRORS.UNAUTHENTICATED);
    }

    // Query active state from MongoDB
    const user = await this.platformUserRepository.findById(jwtUser.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_INACTIVE_OR_NOT_FOUND);
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

    throw new ForbiddenException(AUTH_ERRORS.UNAUTHORIZED_ROLE);
  }
}
