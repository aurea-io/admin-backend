import { Injectable } from '@nestjs/common';
import type { PlatformUser, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PLATFORM_USER_SAFE_SELECT } from '../constants/auth.constants.js';

export type SafePlatformUser = Prisma.PlatformUserGetPayload<{
  select: typeof PLATFORM_USER_SAFE_SELECT;
}>;

export type PasswordCheckPlatformUser = Prisma.PlatformUserGetPayload<{
  select: {
    id: true;
    email: true;
    name: true;
    role: true;
    allowedFeatures: true;
    isActive: true;
    tokenVersion: true;
    passwordHash: true;
  };
}>;

@Injectable()
export class PlatformUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<SafePlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { id },
      select: PLATFORM_USER_SAFE_SELECT,
    });
  }

  async findByIdForProfile(id: string): Promise<SafePlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { id },
      select: PLATFORM_USER_SAFE_SELECT,
    });
  }

  async findByIdForPasswordChange(id: string): Promise<PasswordCheckPlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        allowedFeatures: true,
        isActive: true,
        tokenVersion: true,
        passwordHash: true,
      },
    });
  }

  async findByGoogleId(googleId: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { googleId },
    });
  }

  async updateLastLogin(userId: string): Promise<SafePlatformUser> {
    return this.prisma.platformUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
      select: PLATFORM_USER_SAFE_SELECT,
    });
  }

  async updateGoogleId(userId: string, googleId: string): Promise<PlatformUser> {
    return this.prisma.platformUser.update({
      where: { id: userId },
      data: { googleId },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<SafePlatformUser> {
    return this.prisma.platformUser.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
      select: PLATFORM_USER_SAFE_SELECT,
    });
  }
}
