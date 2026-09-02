import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PlatformJwtPayload } from '../interfaces/jwt-payload.interface.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformJwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request['user'] as PlatformJwtPayload;
  },
);
