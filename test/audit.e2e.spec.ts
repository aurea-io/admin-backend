import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PlatformRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('Audit System HTTP E2E Integration', () => {
  let app: INestApplication;
  let mockPrisma: any;
  let jwtService: JwtService;
  let ownerToken: string;
  let operatorWithoutAuditToken: string;

  const mockOwner = {
    id: '65f1a2b3c4d5e6f7a8b9c001',
    email: 'owner@aurea.io',
    name: 'Platform Owner',
    role: PlatformRole.platform_owner,
    allowedFeatures: [],
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOperator = {
    id: '65f1a2b3c4d5e6f7a8b9c002',
    email: 'operator@aurea.io',
    name: 'Platform Operator',
    role: PlatformRole.platform_operator,
    allowedFeatures: ['platform.tenants.read'], // Missing platform.audit.read
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleTenant = {
    id: '65f1a2b3c4d5e6f7a8b9c010',
    slug: 'beauty-salon',
    name: 'Beauty Salon & Spa',
    vertical: 'beauty',
    status: 'active',
    planKey: 'starter',
    isActive: true,
    maintenanceMode: false,
    maintenanceMessage: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };

  const sampleAuditLog = {
    id: '65f1a2b3c4d5e6f7a8b9c099',
    tenantId: sampleTenant.id,
    actorId: mockOwner.id,
    actorEmail: mockOwner.email,
    actorRole: mockOwner.role,
    action: 'tenants.status_change',
    entity: 'tenants',
    entityId: sampleTenant.id,
    before: { status: 'active', isActive: true },
    after: { status: 'suspended', isActive: false },
    ipAddress: '127.0.0.1',
    userAgent: 'Supertest',
    metadata: { path: `/api/v1/admin/tenants/${sampleTenant.id}/status`, method: 'PATCH' },
    createdAt: new Date('2026-09-04T21:00:00Z'),
  };

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-audit-jwt-secret';

    mockPrisma = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      platformUser: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === mockOwner.id || where.email === mockOwner.email) {
            return Promise.resolve({ ...mockOwner });
          }
          if (where.id === mockOperator.id || where.email === mockOperator.email) {
            return Promise.resolve({ ...mockOperator });
          }
          return Promise.resolve(null);
        }),
      },
      platformTenant: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === sampleTenant.id || where.slug === sampleTenant.slug) {
            return Promise.resolve({ ...sampleTenant });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({
            ...sampleTenant,
            ...data,
            updatedAt: new Date(),
          });
        }),
      },
      platformAuditLog: {
        create: vi.fn().mockResolvedValue(sampleAuditLog),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === sampleAuditLog.id) {
            return Promise.resolve(sampleAuditLog);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockResolvedValue([sampleAuditLog]),
        count: vi.fn().mockResolvedValue(1),
      },
      refreshSession: {
        create: vi.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    ownerToken = jwtService.sign(
      {
        sub: mockOwner.id,
        email: mockOwner.email,
        role: mockOwner.role,
        scope: 'platform',
        tokenVersion: mockOwner.tokenVersion,
      },
      { secret: 'test-audit-jwt-secret', expiresIn: '15m' },
    );

    operatorWithoutAuditToken = jwtService.sign(
      {
        sub: mockOperator.id,
        email: mockOperator.email,
        role: mockOperator.role,
        scope: 'platform',
        tokenVersion: mockOperator.tokenVersion,
      },
      { secret: 'test-audit-jwt-secret', expiresIn: '15m' },
    );
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/audit - should return 401 Unauthorized if no JWT provided', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/audit');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/audit - should return 403 Forbidden if operator lacks platform.audit.read', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit')
      .set('Authorization', `Bearer ${operatorWithoutAuditToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/v1/audit - should return paginated audit logs for platform_owner', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit?entity=tenants&page=1&limit=10')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total', 1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].action).toBe('tenants.status_change');
  });

  it('GET /api/v1/audit/:id - should return single audit log for platform_owner', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/audit/${sampleAuditLog.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sampleAuditLog.id);
    expect(res.body.action).toBe('tenants.status_change');
    expect(res.body.actorEmail).toBe('owner@aurea.io');
  });

  it('PATCH /api/v1/admin/tenants/:id/status - should trigger AuditInterceptor and record audit log with before/after', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/tenants/${sampleTenant.id}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'suspended' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suspended');

    // Give asynchronous non-blocking logging a brief moment to execute
    await new Promise((r) => setTimeout(r, 50));

    expect(mockPrisma.platformAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'tenants.status_change',
        entity: 'tenants',
        entityId: sampleTenant.id,
        actorId: mockOwner.id,
        actorEmail: mockOwner.email,
        before: expect.objectContaining({
          id: sampleTenant.id,
          status: 'active',
          isActive: true,
        }),
        after: expect.objectContaining({
          id: sampleTenant.id,
          status: 'suspended',
          isActive: false,
        }),
      }),
    });
  });
});
