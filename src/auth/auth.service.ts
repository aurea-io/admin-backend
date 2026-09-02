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
   * Realiza la autenticación mediante email y contraseña con hash seguro.
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    const isPasswordValid = await PasswordUtil.compare(dto.password, user?.passwordHash);

    if (!user || !isPasswordValid || !user.isActive) {
      this.logger.warn('Intento de login fallido: credenciales inválidas o usuario inactivo');
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos');
    }

    const updatedUser = await this.touchLastLogin(user.id);
    this.logger.log(`Usuario de plataforma autenticado (ID: ${updatedUser.id}, Rol: ${updatedUser.role})`);

    const accessToken = await this.tokenService.generatePlatformToken(updatedUser);

    return {
      accessToken,
      user: updatedUser,
    };
  }

  /**
   * Autenticación y vinculación transparente de cuentas Google OAuth a partir de idToken verificado.
   */
  async loginWithGoogle(dto: GoogleLoginDto) {
    const verifiedGoogleUser = await this.googleAuthService.verifyIdToken(dto.idToken);
    const user = await this.resolveAndLinkGoogleUser(verifiedGoogleUser);

    if (!user || !user.isActive) {
      this.logger.warn('Intento de login con Google no autorizado o cuenta inactiva');
      throw new UnauthorizedException('Usuario de plataforma no encontrado o no autorizado');
    }

    const updatedUser = await this.touchLastLogin(user.id);
    this.logger.log(`Usuario autenticado vía Google (ID: ${updatedUser.id})`);

    const accessToken = await this.tokenService.generatePlatformToken(updatedUser);

    return {
      accessToken,
      user: updatedUser,
    };
  }

  /**
   * Actualiza la contraseña del usuario e incrementa tokenVersion revocando sesiones activas.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    if (user.passwordHash) {
      const isCurrentValid = await PasswordUtil.compare(dto.currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new BadRequestException('La contraseña actual es incorrecta');
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
      `Contraseña cambiada para usuario ID: ${updatedUser.id}. tokenVersion: ${updatedUser.tokenVersion}`,
    );

    const accessToken = await this.tokenService.generatePlatformToken(updatedUser);

    return {
      message: 'Contraseña actualizada exitosamente. Otras sesiones activas han sido invalidadas.',
      tokenVersion: updatedUser.tokenVersion,
      accessToken,
      user: updatedUser,
    };
  }

  /**
   * Retorna los datos del perfil de plataforma sanitizados.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
      select: PLATFORM_USER_SAFE_SELECT,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario de plataforma no encontrado o inactivo');
    }

    return user;
  }

  // ── Helpers Privados ────────────────────────────────────────────────────────

  private async touchLastLogin(userId: string) {
    return this.prisma.platformUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: PLATFORM_USER_SAFE_SELECT,
    });
  }

  private async resolveAndLinkGoogleUser(googleUser: VerifiedGoogleUser): Promise<PlatformUser | null> {
    const { googleId, email } = googleUser;

    // 1. Buscar por googleId verificado
    let user = await this.prisma.platformUser.findUnique({
      where: { googleId },
    });

    if (user) {
      return user;
    }

    // 2. Buscar por email y vincular googleId si la cuenta existe provisionada
    user = await this.prisma.platformUser.findUnique({
      where: { email },
    });

    if (user && !user.googleId) {
      user = await this.prisma.platformUser.update({
        where: { id: user.id },
        data: { googleId },
      });
      this.logger.log(`Cuenta Google vinculada a usuario existente (ID: ${user.id})`);
    }

    return user;
  }
}
