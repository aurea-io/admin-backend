import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './services/token.service.js';
import { GoogleAuthService, type VerifiedGoogleUser } from './services/google-auth.service.js';
import { PasswordUtil } from './utils/password.util.js';
import { PLATFORM_USER_SAFE_SELECT } from './constants/auth.constants.js';
import type { LoginDto } from './dto/login.dto.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { PlatformUser } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  /**
   * Authenticates a platform user using email and password.
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    const isPasswordValid = await PasswordUtil.compare(dto.password, user?.passwordHash);

    if (!user || !isPasswordValid || !user.isActive) {
      this.logger.warn('Login attempt failed: invalid credentials or inactive account');
      throw new UnauthorizedException('Invalid email address or password');
    }

    const updatedUser = await this.touchLastLogin(user.id);
    this.logger.log(`Platform user authenticated (ID: ${updatedUser.id}, Role: ${updatedUser.role})`);

    const accessToken = await this.tokenService.generatePlatformToken(updatedUser);

    return {
      accessToken,
      user: updatedUser,
    };
  }

  /**
   * Authenticates and links a Google OAuth account from a verified ID token.
   */
  async loginWithGoogle(dto: GoogleLoginDto) {
    const verifiedGoogleUser = await this.googleAuthService.verifyIdToken(dto.idToken);
    const user = await this.resolveAndLinkGoogleUser(verifiedGoogleUser);

    if (!user || !user.isActive) {
      this.logger.warn('Google login attempt failed: unauthorized or inactive platform account');
      throw new UnauthorizedException('Platform user not found or not authorized');
    }

    const updatedUser = await this.touchLastLogin(user.id);
    this.logger.log(`Platform user authenticated via Google (ID: ${updatedUser.id})`);

    const accessToken = await this.tokenService.generatePlatformToken(updatedUser);

    return {
      accessToken,
      user: updatedUser,
    };
  }

  /**
   * Updates platform user password and increments tokenVersion to revoke other sessions.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Platform user not found or inactive');
    }

    if (user.passwordHash) {
      const isCurrentValid = await PasswordUtil.compare(dto.currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    const newPasswordHash = await PasswordUtil.hash(dto.newPassword);

    const updatedUser = await this.prisma.platformUser.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
      select: PLATFORM_USER_SAFE_SELECT,
    });

    this.logger.log(
      `Password changed for user ID: ${updatedUser.id}. tokenVersion incremented to ${updatedUser.tokenVersion}`,
    );

    const accessToken = await this.tokenService.generatePlatformToken(updatedUser);

    return {
      message: 'Password updated successfully. Other active sessions have been revoked.',
      tokenVersion: updatedUser.tokenVersion,
      accessToken,
      user: updatedUser,
    };
  }

  /**
   * Retrieves sanitized profile information for the authenticated platform user.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
      select: PLATFORM_USER_SAFE_SELECT,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Platform user not found or inactive');
    }

    return user;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private async touchLastLogin(userId: string) {
    return this.prisma.platformUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: PLATFORM_USER_SAFE_SELECT,
    });
  }

  private async resolveAndLinkGoogleUser(googleUser: VerifiedGoogleUser): Promise<PlatformUser | null> {
    const { googleId, email } = googleUser;

    // 1. Check by verified googleId
    let user = await this.prisma.platformUser.findUnique({
      where: { googleId },
    });

    if (user) {
      return user;
    }

    // 2. Check by email and link googleId if the provisioned user account exists
    user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    if (user && !user.googleId) {
      user = await this.prisma.platformUser.update({
        where: { id: user.id },
        data: { googleId },
      });
      this.logger.log(`Google account linked to existing platform user (ID: ${user.id})`);
    }

    return user;
  }
}
