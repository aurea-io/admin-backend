import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuditRepository } from '../src/audit/audit.repository.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuditInterceptor } from '../src/audit/interceptors/audit.interceptor.js';
import { AuditController } from '../src/audit/audit.controller.js';
import { FindAuditLogsQueryDto } from '../src/audit/dto/find-audit-logs-query.dto.js';
import { AUDITED_METADATA_KEY } from '../src/audit/constants/audit.constants.js';

describe('Audit System Domain (PLT-13)', () => {
  const sampleAuditLog = {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    tenantId: '65f1a2b3c4d5e6f7a8b9c0d2',
    actorId: 'user-admin-1',
    actorEmail: 'admin@aurea.io',
    actorRole: 'platform_owner',
    action: 'tenants.status_change',
    entity: 'tenants',
    entityId: '65f1a2b3c4d5e6f7a8b9c0d2',
    before: { status: 'active', isActive: true },
    after: { status: 'suspended', isActive: false },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 Chrome/120.0',
    metadata: { path: '/api/v1/admin/tenants/65f1a2b3c4d5e6f7a8b9c0d2/status', method: 'PATCH' },
    createdAt: new Date('2026-09-04T12:00:00Z'),
  };

  describe('AuditRepository', () => {
    let repository: AuditRepository;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        platformAuditLog: {
          create: vi.fn().mockResolvedValue(sampleAuditLog),
          findUnique: vi.fn().mockResolvedValue(sampleAuditLog),
          findMany: vi.fn().mockResolvedValue([sampleAuditLog]),
          count: vi.fn().mockResolvedValue(1),
        },
      };
      repository = new AuditRepository(mockPrisma as any);
    });

    it('should persist an audit log entry in MongoDB platform_audit_logs', async () => {
      const data = {
        tenantId: sampleAuditLog.tenantId,
        actorId: sampleAuditLog.actorId,
        actorEmail: sampleAuditLog.actorEmail,
        actorRole: sampleAuditLog.actorRole,
        action: sampleAuditLog.action,
        entity: sampleAuditLog.entity,
        entityId: sampleAuditLog.entityId,
        before: sampleAuditLog.before,
        after: sampleAuditLog.after,
        ipAddress: sampleAuditLog.ipAddress,
        userAgent: sampleAuditLog.userAgent,
      };

      const result = await repository.create(data);

      expect(mockPrisma.platformAuditLog.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(sampleAuditLog);
    });

    it('should find a single audit log entry by ID', async () => {
      const result = await repository.findById(sampleAuditLog.id);

      expect(mockPrisma.platformAuditLog.findUnique).toHaveBeenCalledWith({
        where: { id: sampleAuditLog.id },
      });
      expect(result).toEqual(sampleAuditLog);
    });

    it('should query audit logs with default pagination', async () => {
      const result = await repository.findAll();

      expect(mockPrisma.platformAuditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should apply filters for entity, actor, tenant, action, and date range', async () => {
      await repository.findAll(
        {
          entity: 'tenants',
          userId: 'admin@aurea.io',
          tenantId: '65f1a2b3c4d5e6f7a8b9c0d2',
          action: 'tenants.status_change',
          startDate: '2026-09-01T00:00:00Z',
          endDate: '2026-09-05T00:00:00Z',
        },
        { limit: 10, offset: 20 },
        { sortBy: 'createdAt', sortOrder: 'asc' },
      );

      expect(mockPrisma.platformAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { entity: { equals: 'tenants', mode: 'insensitive' } },
            {
              OR: [
                { actorId: 'admin@aurea.io' },
                { actorEmail: { equals: 'admin@aurea.io', mode: 'insensitive' } },
              ],
            },
            { tenantId: '65f1a2b3c4d5e6f7a8b9c0d2' },
            { action: { equals: 'tenants.status_change', mode: 'insensitive' } },
            {
              createdAt: {
                gte: new Date('2026-09-01T00:00:00Z'),
                lte: new Date('2026-09-05T00:00:00Z'),
              },
            },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('AuditService', () => {
    let service: AuditService;
    let mockRepo: Record<keyof AuditRepository, any>;
    let mockUserRepo: any;

    beforeEach(() => {
      mockRepo = {
        create: vi.fn().mockResolvedValue(sampleAuditLog),
        findById: vi.fn().mockResolvedValue(sampleAuditLog),
        findAll: vi.fn().mockResolvedValue({
          items: [sampleAuditLog],
          total: 1,
          limit: 20,
          offset: 0,
          page: 1,
          data: [sampleAuditLog],
        }),
      };
      mockUserRepo = {
        findById: vi.fn().mockResolvedValue({
          id: 'user-admin-1',
          email: 'admin@aurea.io',
          role: 'platform_owner',
          isActive: true,
        }),
      };

      service = new AuditService(mockRepo as any, mockUserRepo);
    });

    it('should register entity loaders and resolve snapshots', async () => {
      const dummyLoader = vi.fn().mockResolvedValue({ id: '123', name: 'Acme' });
      service.registerEntityLoader('custom_entity', dummyLoader);

      const snapshot = await service.resolveEntitySnapshot('custom_entity', '123');

      expect(dummyLoader).toHaveBeenCalledWith('123');
      expect(snapshot).toEqual({ id: '123', name: 'Acme' });
    });

    it('should return null if entity loader is not registered or entityId is missing', async () => {
      expect(await service.resolveEntitySnapshot('unknown_entity', '123')).toBeNull();
      expect(await service.resolveEntitySnapshot('custom_entity', '')).toBeNull();
    });

    it('should sanitize sensitive fields recursively from snapshots', () => {
      const dirtyData = {
        id: '123',
        password: 'plain_password',
        passwordHash: '$2b$12$secretHash',
        token: 'jwt-token-string',
        refreshToken: 'refresh-token',
        secret: 'super-secret',
        apiKey: 'key_live_123',
        nested: {
          user: 'john',
          password: 'another_password',
          safeField: 'hello',
        },
        arrayItems: [
          { token: 'secret-token-1', label: 'item-1' },
          { safe: 'value' },
        ],
      };

      const clean = service.sanitizeData(dirtyData);

      expect(clean.password).toBe('[REDACTED]');
      expect(clean.passwordHash).toBe('[REDACTED]');
      expect(clean.token).toBe('[REDACTED]');
      expect(clean.refreshToken).toBe('[REDACTED]');
      expect(clean.secret).toBe('[REDACTED]');
      expect(clean.apiKey).toBe('[REDACTED]');
      expect(clean.nested.password).toBe('[REDACTED]');
      expect(clean.nested.safeField).toBe('hello');
      expect(clean.arrayItems[0].token).toBe('[REDACTED]');
      expect(clean.arrayItems[0].label).toBe('item-1');
    });

    it('should record audit log with sanitized snapshots', async () => {
      const record = await service.recordLog({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        actorEmail: 'test@aurea.io',
        actorRole: 'platform_operator',
        action: 'tenants.create',
        entity: 'tenants',
        entityId: 'tenant-1',
        before: null,
        after: { id: 'tenant-1', passwordHash: 'hash123', name: 'Tenant One' },
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'user-1',
          action: 'tenants.create',
          entity: 'tenants',
          before: null,
          after: expect.objectContaining({
            id: 'tenant-1',
            passwordHash: '[REDACTED]',
            name: 'Tenant One',
          }),
        }),
      );
      expect(record).toEqual(sampleAuditLog);
    });

    it('should handle database write errors gracefully without throwing', async () => {
      mockRepo.create.mockRejectedValueOnce(new Error('MongoDB replica set connection timeout'));

      const record = await service.recordLog({
        actorId: 'user-1',
        action: 'tenants.create',
        entity: 'tenants',
      });

      expect(record).toBeNull();
    });

    it('should query paginated logs with page to offset mapping', async () => {
      await service.findAll({
        page: 3,
        limit: 15,
        entity: 'tenants',
      });

      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'tenants' }),
        { limit: 15, offset: 30 },
        { sortBy: 'createdAt', sortOrder: 'desc' },
      );
    });

    it('should throw NotFoundException if log entry by ID does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);

      await expect(service.findById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('AuditInterceptor', () => {
    let interceptor: AuditInterceptor;
    let mockReflector: any;
    let mockAuditService: any;

    beforeEach(() => {
      mockReflector = {
        getAllAndOverride: vi.fn(),
      };
      mockAuditService = {
        resolveEntitySnapshot: vi.fn().mockResolvedValue({ id: 't-1', name: 'Old Tenant' }),
        recordLog: vi.fn().mockResolvedValue(sampleAuditLog),
      };
      interceptor = new AuditInterceptor(mockReflector, mockAuditService);
    });

    it('should bypass non-HTTP execution contexts', async () => {
      const mockContext: any = {
        getType: () => 'rpc',
      };
      const mockHandler: any = {
        handle: () => of({ success: true }),
      };

      const result = await new Promise((resolve) =>
        interceptor.intercept(mockContext, mockHandler).subscribe(resolve),
      );

      expect(result).toEqual({ success: true });
      expect(mockAuditService.recordLog).not.toHaveBeenCalled();
    });

    it('should bypass routes not decorated with @Audited', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);

      const mockContext: any = {
        getType: () => 'http',
        getHandler: () => ({ name: 'findAll' }),
        getClass: () => ({ name: 'TenantsController' }),
      };
      const mockHandler: any = {
        handle: () => of({ items: [] }),
      };

      const result = await new Promise((resolve) =>
        interceptor.intercept(mockContext, mockHandler).subscribe(resolve),
      );

      expect(result).toEqual({ items: [] });
      expect(mockAuditService.recordLog).not.toHaveBeenCalled();
    });

    it('should ignore safe HTTP methods like GET, HEAD, OPTIONS', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({ entity: 'tenants' });

      const mockReq = { method: 'GET' };
      const mockContext: any = {
        getType: () => 'http',
        getHandler: () => ({ name: 'findAll' }),
        getClass: () => ({ name: 'TenantsController' }),
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      };
      const mockHandler: any = {
        handle: () => of({ items: [] }),
      };

      const result = await new Promise((resolve) =>
        interceptor.intercept(mockContext, mockHandler).subscribe(resolve),
      );

      expect(result).toEqual({ items: [] });
      expect(mockAuditService.recordLog).not.toHaveBeenCalled();
    });

    it('should intercept PATCH mutation, fetch before snapshot, and record audit log with after snapshot', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        entity: 'tenants',
        action: 'tenants.status_change',
        entityIdParam: 'id',
      });

      const mockReq = {
        method: 'PATCH',
        url: '/api/v1/admin/tenants/t-1/status',
        params: { id: 't-1' },
        headers: {
          'x-forwarded-for': '203.0.113.195, 10.0.0.1',
          'user-agent': 'Chrome/120.0',
        },
        user: {
          sub: 'user-admin-1',
          email: 'admin@aurea.io',
          role: 'platform_owner',
        },
      };

      const mockContext: any = {
        getType: () => 'http',
        getHandler: () => ({ name: 'updateStatus' }),
        getClass: () => ({ name: 'TenantsController' }),
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      };

      const updatedResponse = { id: 't-1', name: 'Old Tenant', status: 'suspended' };
      const mockHandler: any = {
        handle: () => of(updatedResponse),
      };

      const result = await new Promise((resolve) =>
        interceptor.intercept(mockContext, mockHandler).subscribe(resolve),
      );

      expect(result).toEqual(updatedResponse);
      expect(mockAuditService.resolveEntitySnapshot).toHaveBeenCalledWith('tenants', 't-1');

      // Wait a tick for non-blocking void invocation
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't-1',
          actorId: 'user-admin-1',
          actorEmail: 'admin@aurea.io',
          actorRole: 'platform_owner',
          action: 'tenants.status_change',
          entity: 'tenants',
          entityId: 't-1',
          before: { id: 't-1', name: 'Old Tenant' },
          after: updatedResponse,
          ipAddress: '203.0.113.195',
          userAgent: 'Chrome/120.0',
        }),
      );
    });

    it('should handle POST create mutation with null before snapshot', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        entity: 'tenants',
        action: 'tenants.create',
      });

      const mockReq = {
        method: 'POST',
        url: '/api/v1/admin/tenants',
        params: {},
        body: { name: 'Brand New', slug: 'brand-new' },
        headers: {},
        ip: '127.0.0.1',
        user: { sub: 'user-1' },
      };

      const mockContext: any = {
        getType: () => 'http',
        getHandler: () => ({ name: 'create' }),
        getClass: () => ({ name: 'TenantsController' }),
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      };

      const createdResponse = { id: 't-new', name: 'Brand New', slug: 'brand-new' };
      const mockHandler: any = {
        handle: () => of(createdResponse),
      };

      const result = await new Promise((resolve) =>
        interceptor.intercept(mockContext, mockHandler).subscribe(resolve),
      );

      expect(result).toEqual(createdResponse);
      expect(mockAuditService.resolveEntitySnapshot).not.toHaveBeenCalled();

      await new Promise((r) => setTimeout(r, 10));

      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenants.create',
          entity: 'tenants',
          entityId: 't-new',
          before: null,
          after: createdResponse,
          ipAddress: '127.0.0.1',
        }),
      );
    });
  });

  describe('AuditController', () => {
    let controller: AuditController;
    let mockAuditService: Record<keyof AuditService, any>;

    beforeEach(() => {
      mockAuditService = {
        findAll: vi.fn().mockResolvedValue({
          items: [sampleAuditLog],
          total: 1,
          limit: 20,
          offset: 0,
          page: 1,
          data: [sampleAuditLog],
        }),
        findById: vi.fn().mockResolvedValue(sampleAuditLog),
        registerEntityLoader: vi.fn(),
        resolveEntitySnapshot: vi.fn(),
        sanitizeData: vi.fn(),
        recordLog: vi.fn(),
      } as any;

      controller = new AuditController(mockAuditService as any);
    });

    it('should delegate findAll queries to auditService', async () => {
      const queryDto = plainToInstance(FindAuditLogsQueryDto, {
        entity: 'tenants',
        page: 1,
        limit: 20,
      });

      const result = await controller.findAll(queryDto);

      expect(mockAuditService.findAll).toHaveBeenCalledWith(queryDto);
      expect(result.items).toHaveLength(1);
    });

    it('should delegate findOne to auditService', async () => {
      const result = await controller.findOne(sampleAuditLog.id);

      expect(mockAuditService.findById).toHaveBeenCalledWith(sampleAuditLog.id);
      expect(result).toEqual(sampleAuditLog);
    });
  });

  describe('FindAuditLogsQueryDto Validation', () => {
    it('should validate valid query parameters', async () => {
      const dto = plainToInstance(FindAuditLogsQueryDto, {
        entity: 'tenants',
        userId: 'admin@aurea.io',
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-04T00:00:00Z',
        limit: 50,
        page: 2,
        sortOrder: 'desc',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(50);
      expect(dto.page).toBe(2);
    });

    it('should fail on invalid date strings or out-of-range limit', async () => {
      const dto = plainToInstance(FindAuditLogsQueryDto, {
        startDate: 'invalid-date',
        limit: 1000, // max is 100
        sortOrder: 'invalid-order',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});
