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
      throw new UnauthorizedException('Token de Google no proporcionado');
    }

    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );

      if (!response.ok) {
        throw new UnauthorizedException('Token de Google inválido o expirado');
      }

      const payload = await response.json();

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException('Claims de Google incompletos o corruptos');
      }

      // Optional Google Client ID audience verification if configured
      const expectedAudience = this.config.get<string>('GOOGLE_CLIENT_ID');
      if (expectedAudience && payload.aud !== expectedAudience) {
        this.logger.warn('Audiencia del token de Google no coincide con GOOGLE_CLIENT_ID');
        throw new UnauthorizedException('Audiencia del token de Google inválida');
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
      this.logger.error(`Error verificando token de Google: ${(error as Error).message}`);
      throw new UnauthorizedException('Fallo al validar credenciales con Google');
    }
  }
}
