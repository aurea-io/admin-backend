import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Cryptographically verifies Google ID Token against Google TokenInfo endpoint
   * and derives identity fields (sub, email, name) exclusively from verified claims.
   */
  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken) {
      throw new UnauthorizedException('Google ID token was not provided');
    }

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid or expired Google ID token');
      }

      const payload = await response.json();

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Incomplete or malformed claims in Google token');
      }

      // Optional Google Client ID audience verification if configured
      const expectedAudience = this.config.get<string>('GOOGLE_CLIENT_ID');
      if (expectedAudience && payload.aud !== expectedAudience) {
        this.logger.warn('Google token audience does not match GOOGLE_CLIENT_ID');
        throw new UnauthorizedException('Invalid Google token audience');
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
      throw new UnauthorizedException('Failed to validate credentials with Google');
    }
  }
}
