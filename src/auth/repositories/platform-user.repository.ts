import { Injectable } from '@nestjs/common';
import type { PlatformUser } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PLATFORM_USER_SAFE_SELECT } from '../constants/auth.constants.js';

@Injectable()
export class PlatformUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { email },
    });
  }

  async findById(id: string, select = PLATFORM_USER_SAFE_SELECT): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { id },
      select,
    });
  }

  async findByGoogleId(googleId: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { googleId },
    });
  }

  async updateLastLogin(userId: string): Promise<PlatformUser> {
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

  async updatePassword(userId: string, passwordHash: string): Promise<PlatformUser> {
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
