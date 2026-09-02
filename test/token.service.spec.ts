import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformRole } from '@prisma/client';
import { TokenService } from '../src/auth/services/token.service.js';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockJwt: any;
  let mockConfig: any;

  beforeEach(() => {
    mockJwt = {
      signAsync: vi.fn().mockResolvedValue('jwt-signed-token-123'),
    };
    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_SECRET') return 'custom-access-secret';
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '2h';
        return null;
      }),
    };
    tokenService = new TokenService(mockJwt, mockConfig);
  });

  it('should format payload with scope platform and sign token', async () => {
    const userParams = {
      id: 'user-id-1',
      email: 'owner@aurea.io',
      name: 'Platform Owner',
      role: PlatformRole.platform_owner,
      tokenVersion: 1,
    };

    const token = await tokenService.generatePlatformToken(userParams);

    expect(token).toBe('jwt-signed-token-123');
    expect(mockJwt.signAsync).toHaveBeenCalledWith(
      {
        sub: 'user-id-1',
        email: 'owner@aurea.io',
        name: 'Platform Owner',
        role: PlatformRole.platform_owner,
        tokenVersion: 1,
        scope: 'platform',
      },
      {
        secret: 'custom-access-secret',
        expiresIn: '2h',
      },
    );
  });
});
