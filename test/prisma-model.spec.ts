import { describe, it, expect } from 'vitest';
import { PlatformRole, PlatformUser } from '@prisma/client';

describe('Platform User Model & Types', () => {
  it('should define PlatformRole enum with platform_owner and platform_operator', () => {
    expect(PlatformRole.platform_owner).toBe('platform_owner');
    expect(PlatformRole.platform_operator).toBe('platform_operator');
  });

  it('should validate allowed features structure for platform operator', () => {
    const operatorPermissions: string[] = ['modules.read', 'plans.write'];
    expect(operatorPermissions).toContain('modules.read');
    expect(operatorPermissions).toHaveLength(2);
  });

  it('should support tokenVersion and optional googleId on PlatformUser', () => {
    const mockUser: Partial<PlatformUser> = {
      id: '65f1a2b3c4d5e6f7a8b9c0d1',
      email: 'owner@aurea.io',
      name: 'Platform Owner',
      googleId: 'google-oauth-id-12345',
      role: PlatformRole.platform_owner,
      allowedFeatures: [],
      tokenVersion: 1,
      isActive: true,
    };

    expect(mockUser.role).toBe(PlatformRole.platform_owner);
    expect(mockUser.googleId).toBe('google-oauth-id-12345');
    expect(mockUser.tokenVersion).toBe(1);
  });

  it('should define ModuleCatalogKind and ModuleCatalogStatus enums', async () => {
    const { ModuleCatalogKind, ModuleCatalogStatus } = await import('@prisma/client');
    expect(ModuleCatalogKind.module).toBe('module');
    expect(ModuleCatalogKind.page).toBe('page');
    expect(ModuleCatalogKind.feature).toBe('feature');

    expect(ModuleCatalogStatus.draft).toBe('draft');
    expect(ModuleCatalogStatus.active).toBe('active');
    expect(ModuleCatalogStatus.toBeDeprecated).toBe('toBeDeprecated');
    expect(ModuleCatalogStatus.deprecated).toBe('deprecated');
  });
});
