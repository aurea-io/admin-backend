import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { PlatformPermissionsGuard } from '../src/auth/guards/platform-permissions.guard.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import type { PlatformJwtPayload } from '../src/auth/interfaces/jwt-payload.interface.js';

describe('Platform Guards & Security Strategy', () => {
  describe('PlatformPermissionsGuard', () => {
    let guard: PlatformPermissionsGuard;
    let mockReflector: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockReflector = {
        getAllAndOverride: vi.fn(),
      };
      mockPrisma = {
        platformUser: {
          findUnique: vi.fn(),
        },
      };
      guard = new PlatformPermissionsGuard(mockReflector, mockPrisma);
    });

    function createMockContext(userPayload?: any): ExecutionContext {
      const mockRequest = {
        user: userPayload,
      };
      return {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn().mockReturnValue({
          getRequest: vi.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;
    }

    it('should allow access if no features are required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext();

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('should throw UnauthorizedException if request is unauthenticated', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['tenants:write']);
      const context = createMockContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should ALWAYS allow platform_owner regardless of required features (unrestricted access)', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['tenants:delete', 'system:restart']);
      const context = createMockContext({ sub: 'owner-id' });

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'owner-id',
        role: PlatformRole.platform_owner,
        allowedFeatures: [], // Empty features array, but role is platform_owner
        isActive: true,
      });

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('should allow platform_operator when user has all required features', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['modules:read', 'tenants:read']);
      const context = createMockContext({ sub: 'operator-id' });

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'operator-id',
        role: PlatformRole.platform_operator,
        allowedFeatures: ['modules:read', 'tenants:read', 'audit:read'],
        isActive: true,
      });

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('should throw ForbiddenException for platform_operator missing required features', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['tenants:delete']);
      const context = createMockContext({ sub: 'operator-id' });

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'operator-id',
        role: PlatformRole.platform_operator,
        allowedFeatures: ['tenants:read', 'modules:read'],
        isActive: true,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException if user in DB is inactive', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['modules:read']);
      const context = createMockContext({ sub: 'operator-id' });

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'operator-id',
        role: PlatformRole.platform_operator,
        allowedFeatures: ['modules:read'],
        isActive: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('JwtStrategy & tokenVersion Revocation', () => {
    let jwtStrategy: JwtStrategy;
    let mockConfig: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockConfig = {
        get: vi.fn().mockReturnValue('test-jwt-secret'),
      };
      mockPrisma = {
        platformUser: {
          findUnique: vi.fn(),
        },
      };
      jwtStrategy = new JwtStrategy(mockConfig, mockPrisma);
    });

    it('should validate and return user payload when token is valid and tokenVersion matches', async () => {
      const validPayload: PlatformJwtPayload = {
        sub: 'user-1',
        email: 'owner@aurea.io',
        name: 'Owner',
        role: PlatformRole.platform_owner,
        tokenVersion: 1,
        scope: 'platform',
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'owner@aurea.io',
        name: 'Owner',
        role: PlatformRole.platform_owner,
        allowedFeatures: [],
        isActive: true,
        tokenVersion: 1,
      });

      const validated = await jwtStrategy.validate(validPayload);
      expect(validated.sub).toBe('user-1');
      expect(validated.role).toBe(PlatformRole.platform_owner);
      expect(validated.scope).toBe('platform');
    });

    it('should reject tokens with non-platform scope', async () => {
      const wrongScopePayload: any = {
        sub: 'user-1',
        email: 'tenant@client.io',
        name: 'Client',
        tokenVersion: 1,
        scope: 'tenant',
      };

      await expect(jwtStrategy.validate(wrongScopePayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject outdated tokens when tokenVersion has been incremented (revoked session)', async () => {
      const oldTokenPayload: PlatformJwtPayload = {
        sub: 'user-1',
        email: 'owner@aurea.io',
        name: 'Owner',
        role: PlatformRole.platform_owner,
        tokenVersion: 1, // Old version in JWT
        scope: 'platform',
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'owner@aurea.io',
        name: 'Owner',
        role: PlatformRole.platform_owner,
        allowedFeatures: [],
        isActive: true,
        tokenVersion: 2, // User has tokenVersion 2 after password change
      });

      await expect(jwtStrategy.validate(oldTokenPayload)).rejects.toThrow(UnauthorizedException);
    });

    it('should reject if platform user is deactivated', async () => {
      const payload: PlatformJwtPayload = {
        sub: 'user-1',
        email: 'owner@aurea.io',
        name: 'Owner',
        role: PlatformRole.platform_owner,
        tokenVersion: 1,
        scope: 'platform',
      };

      mockPrisma.platformUser.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        tokenVersion: 1,
      });

      await expect(jwtStrategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
