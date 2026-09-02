import { Injectable } from '@nestjs/common';
import type { PlatformUser, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PLATFORM_USER_SAFE_SELECT } from '../constants/auth.constants.js';

type SafePlatformUser = Prisma.PlatformUserGetPayload<{
  select: typeof PLATFORM_USER_SAFE_SELECT;
}>;

@Injectable()
export class PlatformUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({
      where: { email },
    });
  }

  async findById<T extends Prisma.PlatformUserSelect | undefined>(
    id: string,
    select: T = PLATFORM_USER_SAFE_SELECT as T,
  ): Promise<Prisma.PlatformUserGetPayload<{ select: T }> | null> {
    return this.prisma.platformUser.findUnique({
      where: { id },
      select: select ?? undefined,
    }) as Prisma.PlatformUserGetPayload<{ select: T }> | null;
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
    }) as Promise<SafePlatformUser>;
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
    }) as Promise<SafePlatformUser>;
  }
}
