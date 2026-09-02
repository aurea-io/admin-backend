import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwt: any;
  let mockConfig: any;

  const testPassword = 'Password123!';
  let testPasswordHash: string;

  beforeEach(async () => {
    testPasswordHash = await bcrypt.hash(testPassword, 10);

    mockPrisma = {
      platformUser: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    mockJwt = {
      signAsync: vi.fn().mockResolvedValue('mock-jwt-token'),
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '1h';
        return null;
      }),
    };

    authService = new AuthService(mockPrisma, mockJwt, mockConfig);
  });

  describe('login', () => {
    it('should successfully log in a valid platform user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        name: 'Admin',
        passwordHash: testPasswordHash,
        role: PlatformRole.platform_owner,
        allowedFeatures: [],
        isActive: true,
        tokenVersion: 1,
        lastLoginAt: null,
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.platformUser.update.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await authService.login({
        email: 'admin@aurea.io',
        password: testPassword,
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('admin@aurea.io');
      expect(mockPrisma.platformUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
        }),
      );
    });

    it('should reject invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        passwordHash: testPasswordHash,
        isActive: true,
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'admin@aurea.io',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject inactive platform user', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'inactive@aurea.io',
        passwordHash: testPasswordHash,
        isActive: false,
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'inactive@aurea.io',
          password: testPassword,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('loginWithGoogle', () => {
    it('should authenticate user if found by googleId', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'operator@aurea.io',
        name: 'Operator',
        googleId: 'google-uid-123',
        role: PlatformRole.platform_operator,
        allowedFeatures: ['modules:read'],
        isActive: true,
        tokenVersion: 1,
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.platformUser.update.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await authService.loginWithGoogle({
        googleId: 'google-uid-123',
        email: 'operator@aurea.io',
        name: 'Operator',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.googleId ?? mockUser.googleId).toBe('google-uid-123');
    });

    it('should link googleId to existing user with matching email and login', async () => {
      const mockUserWithoutGoogle = {
        id: 'user-3',
        email: 'owner@aurea.io',
        name: 'Owner',
        googleId: null,
        role: PlatformRole.platform_owner,
        allowedFeatures: [],
        isActive: true,
        tokenVersion: 1,
      };

      // 1st call (by googleId) returns null, 2nd call (by email) returns mockUserWithoutGoogle
      mockPrisma.platformUser.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockUserWithoutGoogle);

      mockPrisma.platformUser.update
        .mockResolvedValueOnce({
          ...mockUserWithoutGoogle,
          googleId: 'new-google-uid',
        })
        .mockResolvedValueOnce({
          ...mockUserWithoutGoogle,
          googleId: 'new-google-uid',
          lastLoginAt: new Date(),
        });

      const result = await authService.loginWithGoogle({
        googleId: 'new-google-uid',
        email: 'owner@aurea.io',
        name: 'Owner',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrisma.platformUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-3' },
          data: { googleId: 'new-google-uid' },
        }),
      );
    });

    it('should reject unprovisioned Google users', async () => {
      mockPrisma.platformUser.findUnique.mockResolvedValue(null);

      await expect(
        authService.loginWithGoogle({
          googleId: 'unknown-google-id',
          email: 'stranger@gmail.com',
          name: 'Stranger',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should change password, increment tokenVersion and reissue token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        passwordHash: testPasswordHash,
        tokenVersion: 1,
        isActive: true,
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);
      mockPrisma.platformUser.update.mockResolvedValue({
        ...mockUser,
        tokenVersion: 2,
        passwordHash: 'new-hashed-password',
      });

      const result = await authService.changePassword('user-1', {
        currentPassword: testPassword,
        newPassword: 'BrandNewPassword456!',
      });

      expect(result.tokenVersion).toBe(2);
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPrisma.platformUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });

    it('should fail when current password does not match', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        passwordHash: testPasswordHash,
        tokenVersion: 1,
        isActive: true,
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.changePassword('user-1', {
          currentPassword: 'IncorrectPassword',
          newPassword: 'BrandNewPassword456!',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getProfile', () => {
    it('should return sanitized user profile', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        name: 'Admin',
        role: PlatformRole.platform_owner,
        allowedFeatures: [],
        isActive: true,
        tokenVersion: 1,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue(mockUser);

      const profile = await authService.getProfile('user-1');
      expect(profile.id).toBe('user-1');
      expect(profile.email).toBe('admin@aurea.io');
      expect((profile as any).passwordHash).toBeUndefined();
    });
  });
});
