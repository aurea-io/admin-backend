import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service.js';
import { GoogleAuthService } from '../src/auth/services/google-auth.service.js';

describe('GoogleAuthService', () => {
  it('should reject a Google token when email_verified is false', async () => {
    const service = new GoogleAuthService({
      get: vi.fn().mockReturnValue('test-google-client-id'),
    } as unknown as ConfigService);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'google-user-1',
          email: 'owner@aurea.io',
          email_verified: 'false',
          aud: 'test-google-client-id',
          name: 'Owner',
        }),
      }),
    );

    await expect(service.verifyIdToken('fake-google-token')).rejects.toThrow(UnauthorizedException);

    vi.unstubAllGlobals();
  });
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockPlatformUserRepository: any;
  let mockTokenService: any;
  let mockGoogleAuthService: any;
  let mockRefreshSessionRepository: any;

  const testPassword = 'Password123!';
  let testPasswordHash: string;

  beforeEach(async () => {
    testPasswordHash = await bcrypt.hash(testPassword, 10);

    mockPlatformUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByIdForProfile: vi.fn(),
      findByIdForPasswordChange: vi.fn(),
      findByGoogleId: vi.fn(),
      updateLastLogin: vi.fn(),
      updateGoogleId: vi.fn(),
      updatePassword: vi.fn(),
    };

    mockTokenService = {
      generatePlatformToken: vi.fn().mockResolvedValue('mock-jwt-token'),
      generateRefreshToken: vi.fn().mockReturnValue('opaque-refresh-token'),
      hashRefreshToken: vi.fn().mockReturnValue('refresh-token-hash'),
    };

    mockGoogleAuthService = {
      verifyIdToken: vi.fn(),
    };
    mockRefreshSessionRepository = {
      create: vi.fn().mockResolvedValue({ id: 'refresh-session-1' }),
      revokeAllForUser: vi.fn().mockResolvedValue({ count: 1 }),
      findByHash: vi.fn(),
      revokeForRotation: vi.fn(),
      markReplaced: vi.fn(),
      revokeByHash: vi.fn(),
    };

    authService = new AuthService(mockPlatformUserRepository, mockTokenService, mockGoogleAuthService, mockRefreshSessionRepository);
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

      mockPlatformUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockPlatformUserRepository.updateLastLogin.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await authService.login({
        email: 'admin@aurea.io',
        password: testPassword,
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.email).toBe('admin@aurea.io');
      expect(mockPlatformUserRepository.updateLastLogin).toHaveBeenCalledWith('user-1');
    });

    it('should reject invalid password', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        passwordHash: testPasswordHash,
        isActive: true,
      };

      mockPlatformUserRepository.findByEmail.mockResolvedValue(mockUser);

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

      mockPlatformUserRepository.findByEmail.mockResolvedValue(mockUser);

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

      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'google-uid-123',
        email: 'operator@aurea.io',
        name: 'Operator',
      });

      mockPlatformUserRepository.findByGoogleId.mockResolvedValue(mockUser);
      mockPlatformUserRepository.updateLastLogin.mockResolvedValue({
        ...mockUser,
        lastLoginAt: new Date(),
      });

      const result = await authService.loginWithGoogle({
        idToken: 'valid-google-id-token',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockGoogleAuthService.verifyIdToken).toHaveBeenCalledWith('valid-google-id-token');
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

      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'new-google-uid',
        email: 'owner@aurea.io',
        name: 'Owner',
      });

      // 1st call (by googleId) returns null, 2nd call (by email) returns mockUserWithoutGoogle
      mockPlatformUserRepository.findByGoogleId.mockResolvedValueOnce(null);
      mockPlatformUserRepository.findByEmail.mockResolvedValueOnce(mockUserWithoutGoogle);
      mockPlatformUserRepository.updateGoogleId.mockResolvedValueOnce({
        ...mockUserWithoutGoogle,
        googleId: 'new-google-uid',
      });
      mockPlatformUserRepository.updateLastLogin.mockResolvedValueOnce({
        ...mockUserWithoutGoogle,
        googleId: 'new-google-uid',
        lastLoginAt: new Date(),
      });

      const result = await authService.loginWithGoogle({
        idToken: 'valid-google-id-token',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(mockPlatformUserRepository.updateGoogleId).toHaveBeenCalledWith('user-3', 'new-google-uid');
    });

    it('should reject unprovisioned Google users', async () => {
      mockGoogleAuthService.verifyIdToken.mockResolvedValue({
        googleId: 'unknown-google-id',
        email: 'stranger@gmail.com',
        name: 'Stranger',
      });

      mockPlatformUserRepository.findByGoogleId.mockResolvedValue(null);
      mockPlatformUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.loginWithGoogle({
          idToken: 'unprovisioned-token',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('should validate the current password before changing it', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        passwordHash: testPasswordHash,
        tokenVersion: 1,
        isActive: true,
      };

      mockPlatformUserRepository.findByIdForPasswordChange.mockResolvedValue(mockUser);
      mockPlatformUserRepository.updatePassword.mockResolvedValue({
        ...mockUser,
        tokenVersion: 2,
        passwordHash: 'new-hashed-password',
      });

      await authService.changePassword('user-1', {
        currentPassword: testPassword,
        newPassword: 'BrandNewPassword456!',
      });

      expect(mockPlatformUserRepository.findByIdForPasswordChange).toHaveBeenCalledWith('user-1');
      expect(mockPlatformUserRepository.updatePassword).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('should change password, increment tokenVersion and reissue token', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@aurea.io',
        passwordHash: testPasswordHash,
        tokenVersion: 1,
        isActive: true,
      };

      mockPlatformUserRepository.findByIdForPasswordChange.mockResolvedValue(mockUser);
      mockPlatformUserRepository.updatePassword.mockResolvedValue({
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
      expect(mockPlatformUserRepository.updatePassword).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
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

      mockPlatformUserRepository.findByIdForPasswordChange.mockResolvedValue(mockUser);

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

      mockPlatformUserRepository.findByIdForProfile.mockResolvedValue(mockUser);

      const profile = await authService.getProfile('user-1');
      expect(profile.id).toBe('user-1');
      expect(profile.email).toBe('admin@aurea.io');
      expect((profile as any).passwordHash).toBeUndefined();
    });
  });
});
