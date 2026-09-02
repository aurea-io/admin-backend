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
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    const secret = config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET debe estar configurado en las variables de entorno');
    }
    this.secret = secret;
    this.expiresIn = config.get<string>('JWT_ACCESS_EXPIRES_IN') || '1h';
  }

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
      secret: this.secret,
      expiresIn: this.expiresIn as any,
    });
  }
}
