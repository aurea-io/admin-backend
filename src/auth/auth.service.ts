import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TokenService } from './services/token.service.js';
import { GoogleAuthService, type VerifiedGoogleUser } from './services/google-auth.service.js';
import { PasswordUtil } from './utils/password.util.js';
import { PlatformUserRepository } from './repositories/platform-user.repository.js';
import { RefreshSessionRepository } from './repositories/refresh-session.repository.js';
import {
  AUTH_ERRORS,
  AUTH_MESSAGES,
  AUTH_CONFIG,
  PLATFORM_USER_SAFE_SELECT,
} from './constants/auth.constants.js';
import type { LoginDto } from './dto/login.dto.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { PlatformUser } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly platformUserRepository: PlatformUserRepository,
    private readonly tokenService: TokenService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly refreshSessionRepository: RefreshSessionRepository,
  ) {}

  /**
   * Authenticates a platform user using email and password.
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.platformUserRepository.findByEmail(email);

    const isPasswordValid = await PasswordUtil.compare(dto.password, user?.passwordHash);

    if (!user || !isPasswordValid || !user.isActive) {
      this.logger.warn('Login attempt failed: invalid credentials or inactive account');
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    const updatedUser = await this.touchLastLogin(user.id);
    this.logger.log(`Platform user authenticated (ID: ${updatedUser.id}, Role: ${updatedUser.role})`);

    return this.createSession(updatedUser);
  }

  /**
   * Authenticates and links a Google OAuth account from a verified ID token.
   */
  async loginWithGoogle(dto: GoogleLoginDto) {
    const verifiedGoogleUser = await this.googleAuthService.verifyIdToken(dto.idToken);
    const user = this.requireActiveUser(
      await this.resolveAndLinkGoogleUser(verifiedGoogleUser),
      AUTH_ERRORS.GOOGLE_UNAUTHORIZED_USER,
      'Google login attempt failed: unauthorized or inactive platform account',
    );

    const updatedUser = await this.touchLastLogin(user.id);
    this.logger.log(`Platform user authenticated via Google (ID: ${updatedUser.id})`);

    return this.createSession(updatedUser);
  }

  /**
   * Updates platform user password and increments tokenVersion to revoke other sessions.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = this.requireActiveUser(
      await this.platformUserRepository.findByIdForPasswordChange(userId),
      AUTH_ERRORS.USER_INACTIVE_OR_NOT_FOUND,
    );

    if (user.passwordHash) {
      const isCurrentValid = await PasswordUtil.compare(dto.currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new BadRequestException(AUTH_ERRORS.CURRENT_PASSWORD_INCORRECT);
      }
    }

    const newPasswordHash = await PasswordUtil.hash(dto.newPassword);

    const updatedUser = await this.platformUserRepository.updatePassword(userId, newPasswordHash);
    await this.refreshSessionRepository.revokeAllForUser(userId);

    this.logger.log(
      `Password changed for user ID: ${updatedUser.id}. tokenVersion incremented to ${updatedUser.tokenVersion}`,
    );

    const session = await this.createSession(updatedUser);

    return {
      message: AUTH_MESSAGES.PASSWORD_UPDATED,
      tokenVersion: updatedUser.tokenVersion,
      ...session,
    };
  }

  async refresh(rawToken: string) {
    const session = await this.refreshSessionRepository.findByHash(this.tokenService.hashRefreshToken(rawToken));
    if (!session || session.expiresAt <= new Date()) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }
    if (session.revokedAt) {
      // A revoked token presented again is credential theft/replay: invalidate every session.
      await this.refreshSessionRepository.revokeAllForUser(session.userId);
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }
    if (!session.user.isActive || session.tokenVersion !== session.user.tokenVersion) {
      throw new UnauthorizedException(AUTH_ERRORS.USER_INACTIVE_OR_NOT_FOUND);
    }

    const claimed = await this.refreshSessionRepository.revokeForRotation(session.id);
    if (!claimed) {
      await this.refreshSessionRepository.revokeAllForUser(session.userId);
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_REFRESH_TOKEN);
    }
    const replacement = await this.createSession(session.user);
    await this.refreshSessionRepository.markReplaced(session.id, replacement.refreshSessionId);
    return replacement;
  }

  async logout(rawToken?: string) {
    if (rawToken) {
      await this.refreshSessionRepository.revokeByHash(this.tokenService.hashRefreshToken(rawToken));
    }
  }

  /**
   * Retrieves sanitized profile information for the authenticated platform user.
   */
  async getProfile(userId: string) {
    const user = this.requireActiveUser(
      await this.platformUserRepository.findByIdForProfile(userId),
      AUTH_ERRORS.USER_INACTIVE_OR_NOT_FOUND,
    );

    return user;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private requireActiveUser<T extends { id: string; isActive: boolean }>(
    user: T | null,
    errorMessage: string,
    contextMessage?: string,
  ): T {
    if (!user || !user.isActive) {
      if (contextMessage) {
        this.logger.warn(contextMessage);
      }
      throw new UnauthorizedException(errorMessage);
    }

    return user;
  }

  private async touchLastLogin(userId: string) {
    return this.platformUserRepository.updateLastLogin(userId);
  }

  private async createSession(user: { id: string; email: string; name: string; role: any; tokenVersion: number }) {
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshSession = await this.refreshSessionRepository.create(
      user.id,
      this.tokenService.hashRefreshToken(refreshToken),
      user.tokenVersion,
      this.refreshExpiresAt(),
    );
    return {
      accessToken: await this.tokenService.generatePlatformToken(user),
      user,
      refreshToken,
      refreshSessionId: refreshSession.id,
    };
  }

  private refreshExpiresAt(): Date {
    const value = process.env.JWT_REFRESH_EXPIRES_IN || AUTH_CONFIG.DEFAULT_REFRESH_EXPIRES_IN;
    const match = /^(\d+)([smhd])$/.exec(value);
    const multiplier = match ? ({ s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const)[match[2] as 's' | 'm' | 'h' | 'd'] : 86_400_000;
    return new Date(Date.now() + (match ? Number(match[1]) * multiplier : 7 * multiplier));
  }

  private async resolveAndLinkGoogleUser(googleUser: VerifiedGoogleUser): Promise<PlatformUser | null> {
    const { googleId, email } = googleUser;

    // 1. Check by verified googleId
    let user = await this.platformUserRepository.findByGoogleId(googleId);

    if (user) {
      return user;
    }

    // 2. Check by email and link googleId if the provisioned user account exists
    user = await this.platformUserRepository.findByEmail(email);

    if (user && !user.googleId) {
      user = await this.platformUserRepository.updateGoogleId(user.id, googleId);
      this.logger.log(`Google account linked to existing platform user (ID: ${user.id})`);
    }

    return user;
  }
}
