import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PlatformRole } from '@prisma/client';
import type { PlatformJwtPayload } from '../interfaces/jwt-payload.interface.js';

export interface IssuePlatformTokenParams {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  tokenVersion: number;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generates a signed platform JWT containing identity, scope, and tokenVersion for revocation.
   */
  async generatePlatformToken(user: IssuePlatformTokenParams): Promise<string> {
    const payload: PlatformJwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
      scope: 'platform',
    };

    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET') || 'default-platform-jwt-secret',
      expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') || '1h') as any,
    });
  }
}
