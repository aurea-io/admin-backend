import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { GoogleLoginDto } from './dto/google-login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { PlatformJwtPayload } from './interfaces/jwt-payload.interface.js';
import type { PlatformUser } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

const PLATFORM_USER_SAFE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  allowedFeatures: true,
  isActive: true,
  tokenVersion: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.platformUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    const hashToCheck =
      user?.passwordHash ?? '$2b$12$invalidhashpaddingtopreventemailenumerationtimingattack';
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCheck);

    if (!user || !isPasswordValid || !user.isActive) {
      this.logger.warn(`Intento de login fallido para: ${dto.email}`);
      throw new UnauthorizedException('Correo electrónico o contraseña incorrectos');
    }

    const updatedUser = await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: PLATFORM_USER_SAFE_SELECT,
    });

    this.logger.log(`Usuario de plataforma logueado: ${updatedUser.email} (${updatedUser.role})`);
    const accessToken = await this.generateToken(updatedUser);

    return {
      accessToken,
      user: updatedUser,
    };
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const email = dto.email.toLowerCase().trim();

    let user = await this.prisma.platformUser.findUnique({
      where: { googleId: dto.googleId },
    });

    if (!user) {
      user = await this.prisma.platformUser.findUnique({
        where: { email },
      });

      if (user) {
        // Vinculación segura de cuenta Google para usuario existente
        if (!user.googleId) {
          user = await this.prisma.platformUser.update({
            where: { id: user.id },
            data: { googleId: dto.googleId },
          });
          this.logger.log(`Cuenta Google vinculada a usuario existente: ${email}`);
        }
      }
    }

    if (!user || !user.isActive) {
      this.logger.warn(`Intento de login con Google no autorizado o inexistente: ${email}`);
      throw new UnauthorizedException('Usuario de plataforma no encontrado o no autorizado');
    }

    const updatedUser = await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: PLATFORM_USER_SAFE_SELECT,
    });

    this.logger.log(`Usuario autenticado vía Google: ${updatedUser.email}`);
    const accessToken = await this.generateToken(updatedUser);

    return {
      accessToken,
      user: updatedUser,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    if (user.passwordHash) {
      const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        throw new BadRequestException('La contraseña actual es incorrecta');
      }
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Incrementamos tokenVersion para revocar cualquier sesión anterior activa
    const updatedUser = await this.prisma.platformUser.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
      select: PLATFORM_USER_SAFE_SELECT,
    });

    this.logger.log(`Contraseña cambiada para: ${updatedUser.email}. tokenVersion incrementado a ${updatedUser.tokenVersion}`);
    const accessToken = await this.generateToken(updatedUser);

    return {
      message: 'Contraseña actualizada exitosamente. Otras sesiones activas han sido invalidadas.',
      tokenVersion: updatedUser.tokenVersion,
      accessToken,
      user: updatedUser,
    };
  }

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

  private async generateToken(
    user: Pick<PlatformUser, 'id' | 'email' | 'name' | 'role' | 'tokenVersion'>,
  ): Promise<string> {
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
