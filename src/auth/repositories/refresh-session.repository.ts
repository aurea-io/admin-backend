import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PLATFORM_USER_SAFE_SELECT } from '../constants/auth.constants.js';

@Injectable()
export class RefreshSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, tokenHash: string, tokenVersion: number, expiresAt: Date) {
    return this.prisma.refreshSession.create({ data: { userId, tokenHash, tokenVersion, expiresAt } });
  }

  findByHash(tokenHash: string) {
    return this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: { select: PLATFORM_USER_SAFE_SELECT } },
    });
  }

  /** Atomically claims an active refresh token, preventing concurrent rotations. */
  async revokeForRotation(id: string): Promise<boolean> {
    const result = await this.prisma.refreshSession.updateMany({
      where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });
    return result.count === 1;
  }

  markReplaced(id: string, replacementId: string) {
    return this.prisma.refreshSession.update({ where: { id }, data: { replacedBy: replacementId } });
  }

  revokeByHash(tokenHash: string) {
    return this.prisma.refreshSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
