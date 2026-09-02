import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AUTH_CONFIG,
  AUTH_ENV_KEYS,
  AUTH_ERRORS,
} from '../constants/auth.constants.js';

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly expectedAudience: string;

  constructor(private readonly config: ConfigService) {
    const expectedAudience = config.get<string>(AUTH_ENV_KEYS.GOOGLE_CLIENT_ID);
    if (!expectedAudience) {
      throw new Error(AUTH_ERRORS.GOOGLE_CLIENT_ID_NOT_CONFIGURED);
    }
    this.expectedAudience = expectedAudience;
  }

  /**
   * Cryptographically verifies Google ID Token against Google TokenInfo endpoint
   * and derives identity fields (sub, email, name) exclusively from verified claims.
   */
  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken) {
      throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_TOKEN_NOT_PROVIDED);
    }

    try {
      const response = await fetch(
        `${AUTH_CONFIG.GOOGLE_TOKENINFO_ENDPOINT}?id_token=${encodeURIComponent(idToken)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_TOKEN_INVALID_OR_EXPIRED);
      }

      const payload = await response.json();

      if (!payload.sub || !payload.email || !payload.email_verified) {
        throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_CLAIMS_MALFORMED);
      }

      const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
      if (!emailVerified) {
        throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_CLAIMS_MALFORMED);
      }

      if (payload.aud !== this.expectedAudience) {
        this.logger.warn('Google token audience does not match GOOGLE_CLIENT_ID');
        throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_AUDIENCE_MISMATCH);
      }

      return {
        googleId: payload.sub,
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.email.split('@')[0],
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Error verifying Google token: ${(error as Error).message}`);
      throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_VALIDATION_FAILED);
    }
  }
}
