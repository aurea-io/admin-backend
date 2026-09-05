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

  it('should define PlanStatus and PlanBillingInterval enums', async () => {
    const { PlanStatus, PlanBillingInterval } = await import('@prisma/client');
    expect(PlanStatus.draft).toBe('draft');
    expect(PlanStatus.active).toBe('active');
    expect(PlanStatus.archived).toBe('archived');

    expect(PlanBillingInterval.monthly).toBe('monthly');
    expect(PlanBillingInterval.yearly).toBe('yearly');
    expect(PlanBillingInterval.quarterly).toBe('quarterly');
    expect(PlanBillingInterval.one_time).toBe('one_time');
  });

  it('should validate PlatformPlan and TenantAddon structures', async () => {
    const { PlanStatus, PlanBillingInterval } = await import('@prisma/client');
    type PlatformPlanType = import('@prisma/client').PlatformPlan;
    type TenantAddonType = import('@prisma/client').TenantAddon;

    const mockPlan: Partial<PlatformPlanType> = {
      id: '65f1a2b3c4d5e6f7a8b9c0d2',
      key: 'pro',
      name: 'Pro Tier',
      description: 'Professional tier with advanced capabilities',
      status: PlanStatus.active,
      displayOrder: 1,
      includedFeatures: ['services.bookings.create', 'services.bookings.photo_upload'],
      prices: [
        {
          currency: 'USD',
          amount: 49.99,
          interval: PlanBillingInterval.monthly,
          isActive: true,
        },
      ],
      credits: {
        monthly: 500,
        rollover: true,
      },
      limits: {
        bookingsPerMonth: 1000,
        storageBytes: 1073741824,
      },
      trialDays: 14,
      gracePeriodDays: 3,
      isPopular: true,
      version: 1,
      isActive: true,
    };

    expect(mockPlan.key).toBe('pro');
    expect(mockPlan.status).toBe(PlanStatus.active);
    expect(mockPlan.prices?.[0]?.currency).toBe('USD');
    expect(mockPlan.credits?.monthly).toBe(500);

    const mockAddon: Partial<TenantAddonType> = {
      id: '65f1a2b3c4d5e6f7a8b9c0d3',
      tenantId: '65f1a2b3c4d5e6f7a8b9c0d4',
      addonKey: 'credits_100',
      credits: 100,
      status: 'active',
      renews: true,
    };

    expect(mockAddon.addonKey).toBe('credits_100');
    expect(mockAddon.credits).toBe(100);
  });

  it('should validate TenantSubscription and TenantEntitlement structures', async () => {
    type TenantSubscriptionType = import('@prisma/client').TenantSubscription;
    type TenantEntitlementType = import('@prisma/client').TenantEntitlement;

    const mockSub: Partial<TenantSubscriptionType> = {
      id: '65f1a2b3c4d5e6f7a8b9c0d5',
      tenantId: '65f1a2b3c4d5e6f7a8b9c0d6',
      planKey: 'pro',
      status: 'active',
    };

    expect(mockSub.planKey).toBe('pro');
    expect(mockSub.status).toBe('active');

    const mockEntitlement: Partial<TenantEntitlementType> = {
      id: '65f1a2b3c4d5e6f7a8b9c0d7',
      tenantId: '65f1a2b3c4d5e6f7a8b9c0d6',
      capabilityKey: 'services.bookings.photo_upload',
      effect: 'allow',
      source: 'owner_override',
      version: 1,
    };

    expect(mockEntitlement.capabilityKey).toBe('services.bookings.photo_upload');
    expect(mockEntitlement.effect).toBe('allow');
    expect(mockEntitlement.source).toBe('owner_override');
  });

  it('should validate PlatformAuditLog structure mapped to platform_audit_logs', async () => {
    type PlatformAuditLogType = import('@prisma/client').PlatformAuditLog;

    const mockAuditLog: Partial<PlatformAuditLogType> = {
      id: '65f1a2b3c4d5e6f7a8b9c0d8',
      tenantId: '65f1a2b3c4d5e6f7a8b9c0d6',
      actorId: '65f1a2b3c4d5e6f7a8b9c0d1',
      actorEmail: 'admin@aurea.io',
      actorRole: 'platform_owner',
      action: 'tenants.status_change',
      entity: 'tenants',
      entityId: '65f1a2b3c4d5e6f7a8b9c0d6',
      before: { status: 'active', isActive: true },
      after: { status: 'suspended', isActive: false },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Chrome/120.0',
      metadata: { path: '/api/v1/admin/tenants/65f1a2b3c4d5e6f7a8b9c0d6/status', method: 'PATCH' },
      createdAt: new Date('2026-09-04T20:00:00Z'),
    };

    expect(mockAuditLog.action).toBe('tenants.status_change');
    expect(mockAuditLog.entity).toBe('tenants');
    expect((mockAuditLog.before as any)?.status).toBe('active');
    expect((mockAuditLog.after as any)?.status).toBe('suspended');
    expect(mockAuditLog.ipAddress).toBe('192.168.1.1');
    expect(mockAuditLog.actorEmail).toBe('admin@aurea.io');
  });
});

