import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { TenantsService } from '../src/platform/tenants/tenants.service.js';
import { TenantsController } from '../src/platform/tenants/tenants.controller.js';
import { TenantsRepository } from '../src/platform/tenants/tenants.repository.js';
import {
  CreateTenantDto,
  FindTenantsQueryDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
  UpdateTenantEntitlementsDto,
  CapabilityOverrideDto,
  TenantAddonAssignmentDto,
} from '../src/platform/tenants/dto/index.js';
import { TENANTS_MESSAGES } from '../src/platform/tenants/tenants.constants.js';

describe('Merchant Tenants Management Domain', () => {
  let service: TenantsService;
  let controller: TenantsController;
  let mockRepo: Record<keyof TenantsRepository, any>;

  const sampleTenant = {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    slug: 'acme-beauty',
    name: 'Acme Beauty & Spa',
    vertical: 'services',
    status: 'active',
    planKey: 'pro',
    isActive: true,
    maintenanceMode: false,
    maintenanceMessage: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };

  const sampleEntitlement = {
    id: '65f1a2b3c4d5e6f7a8b9c0d2',
    tenantId: '65f1a2b3c4d5e6f7a8b9c0d1',
    capabilityKey: 'services.bookings.photo_upload',
    effect: 'allow',
    source: 'owner_override',
    creditCost: 0,
    creditAllocationId: null,
    expiresAt: null,
    reason: 'VIP exception',
    changedBy: 'user-admin-1',
    version: 1,
    createdAt: new Date('2026-09-02T00:00:00Z'),
    updatedAt: new Date('2026-09-02T00:00:00Z'),
  };

  const sampleAddon = {
    id: '65f1a2b3c4d5e6f7a8b9c0d3',
    tenantId: '65f1a2b3c4d5e6f7a8b9c0d1',
    addonKey: 'credits_500',
    credits: 500,
    status: 'active',
    renews: true,
    validUntil: null,
    createdAt: new Date('2026-09-02T00:00:00Z'),
    updatedAt: new Date('2026-09-02T00:00:00Z'),
  };

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findByIdOrSlug: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      updateStatus: vi.fn(),
      upsertEntitlement: vi.fn(),
      assignAddon: vi.fn(),
      findEntitlements: vi.fn(),
      findAddons: vi.fn(),
    } as any;

    service = new TenantsService(mockRepo as unknown as TenantsRepository);
    controller = new TenantsController(service);
  });

  describe('TenantsService', () => {
    describe('findAll', () => {
      it('should delegate to repository.findAll with mapped filters, search, and pagination', async () => {
        mockRepo.findAll.mockResolvedValue({
          items: [sampleTenant],
          total: 1,
          limit: 20,
          offset: 0,
          page: 1,
        });

        const query: FindTenantsQueryDto = {
          search: 'Acme',
          status: 'active',
          plan: 'pro',
          limit: 20,
          offset: 0,
        };

        const result = await service.findAll(query);

        expect(mockRepo.findAll).toHaveBeenCalledWith(
          {
            search: 'Acme',
            status: 'active',
            plan: 'pro',
            isActive: undefined,
          },
          { limit: 20, offset: 0 },
          { sortBy: undefined, sortOrder: undefined },
        );
        expect(result.items).toEqual([sampleTenant]);
        expect(result.total).toBe(1);
      });

      it('should calculate offset when page is provided instead of offset', async () => {
        mockRepo.findAll.mockResolvedValue({
          items: [sampleTenant],
          total: 50,
          limit: 10,
          offset: 20,
          page: 3,
        });

        const query: FindTenantsQueryDto = {
          page: 3,
          limit: 10,
        };

        await service.findAll(query);

        expect(mockRepo.findAll).toHaveBeenCalledWith(
          expect.any(Object),
          { limit: 10, offset: 20 },
          expect.any(Object),
        );
      });
    });

    describe('findByIdOrSlug & findById', () => {
      it('should return the tenant when found by ID or slug', async () => {
        mockRepo.findByIdOrSlug.mockResolvedValue(sampleTenant);

        const result = await service.findByIdOrSlug('acme-beauty');

        expect(mockRepo.findByIdOrSlug).toHaveBeenCalledWith('acme-beauty');
        expect(result).toEqual(sampleTenant);
      });

      it('should throw NotFoundException when tenant is not found', async () => {
        mockRepo.findByIdOrSlug.mockResolvedValue(null);

        await expect(service.findByIdOrSlug('unknown-slug')).rejects.toThrow(NotFoundException);
        await expect(service.findByIdOrSlug('unknown-slug')).rejects.toThrow(TENANTS_MESSAGES.NOT_FOUND);
      });

      it('should find tenant by ID directly', async () => {
        mockRepo.findById.mockResolvedValue(sampleTenant);

        const result = await service.findById(sampleTenant.id);

        expect(mockRepo.findById).toHaveBeenCalledWith(sampleTenant.id);
        expect(result).toEqual(sampleTenant);
      });
    });

    describe('create', () => {
      it('should create a tenant with normalized lowercase slug', async () => {
        const dto: CreateTenantDto = {
          name: '  Acme Beauty & Spa  ',
          slug: 'ACME-BEAUTY',
          vertical: 'Services',
          planKey: 'pro',
        };

        mockRepo.create.mockResolvedValue(sampleTenant);

        const result = await service.create(dto);

        expect(mockRepo.create).toHaveBeenCalledWith({
          name: 'Acme Beauty & Spa',
          slug: 'acme-beauty',
          vertical: 'services',
          planKey: 'pro',
          status: 'active',
          isActive: true,
        });
        expect(result).toEqual(sampleTenant);
      });

      it('should map Prisma P2002 conflict error to ConflictException', async () => {
        const dto: CreateTenantDto = {
          name: 'Acme Duplicate',
          slug: 'acme-beauty',
          vertical: 'services',
        };

        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint violation',
          { code: 'P2002', clientVersion: '6.x' },
        );
        mockRepo.create.mockRejectedValue(prismaError);

        await expect(service.create(dto)).rejects.toThrow(ConflictException);
        await expect(service.create(dto)).rejects.toThrow(TENANTS_MESSAGES.SLUG_EXISTS);
      });
    });

    describe('update', () => {
      it('should update tenant metadata and sync status/isActive', async () => {
        mockRepo.findById.mockResolvedValue(sampleTenant);
        mockRepo.updateById.mockResolvedValue({
          ...sampleTenant,
          name: 'Acme Beauty Premium',
          status: 'suspended',
          isActive: false,
        });

        const dto: UpdateTenantDto = {
          name: 'Acme Beauty Premium',
          status: 'suspended',
        };

        const result = await service.update(sampleTenant.id, dto);

        expect(mockRepo.findById).toHaveBeenCalledWith(sampleTenant.id);
        expect(mockRepo.updateById).toHaveBeenCalledWith(sampleTenant.id, {
          name: 'Acme Beauty Premium',
          status: 'suspended',
          isActive: false,
        });
        expect(result.name).toBe('Acme Beauty Premium');
        expect(result.status).toBe('suspended');
      });
    });

    describe('updateStatus (Suspension & Reactivation)', () => {
      it('should suspend tenant when status=suspended is requested', async () => {
        mockRepo.findById.mockResolvedValue(sampleTenant);
        mockRepo.updateStatus.mockResolvedValue({
          ...sampleTenant,
          status: 'suspended',
          isActive: false,
        });

        const dto: UpdateTenantStatusDto = { status: 'suspended' };
        const result = await service.updateStatus(sampleTenant.id, dto);

        expect(mockRepo.updateStatus).toHaveBeenCalledWith(sampleTenant.id, 'suspended', false);
        expect(result.status).toBe('suspended');
        expect(result.isActive).toBe(false);
      });

      it('should reactivate tenant when status=active is requested', async () => {
        mockRepo.findById.mockResolvedValue({
          ...sampleTenant,
          status: 'suspended',
          isActive: false,
        });
        mockRepo.updateStatus.mockResolvedValue({
          ...sampleTenant,
          status: 'active',
          isActive: true,
        });

        const dto: UpdateTenantStatusDto = { status: 'active' };
        const result = await service.updateStatus(sampleTenant.id, dto);

        expect(mockRepo.updateStatus).toHaveBeenCalledWith(sampleTenant.id, 'active', true);
        expect(result.status).toBe('active');
        expect(result.isActive).toBe(true);
      });

      it('should handle boolean isActive=false as suspension', async () => {
        mockRepo.findById.mockResolvedValue(sampleTenant);
        mockRepo.updateStatus.mockResolvedValue({
          ...sampleTenant,
          status: 'suspended',
          isActive: false,
        });

        const dto: UpdateTenantStatusDto = { isActive: false };
        const result = await service.updateStatus(sampleTenant.id, dto);

        expect(mockRepo.updateStatus).toHaveBeenCalledWith(sampleTenant.id, 'suspended', false);
        expect(result.isActive).toBe(false);
      });
    });

    describe('updateEntitlements & Addons Overrides', () => {
      it('should apply capability overrides and assign addons', async () => {
        mockRepo.findById.mockResolvedValue(sampleTenant);
        mockRepo.upsertEntitlement.mockResolvedValue(sampleEntitlement);
        mockRepo.assignAddon.mockResolvedValue(sampleAddon);
        mockRepo.findEntitlements.mockResolvedValue([sampleEntitlement]);
        mockRepo.findAddons.mockResolvedValue([sampleAddon]);

        const dto: UpdateTenantEntitlementsDto = {
          overrides: [
            {
              capabilityKey: 'services.bookings.photo_upload',
              effect: 'allow',
              reason: 'VIP exception',
            },
          ],
          addons: [
            {
              addonKey: 'credits_500',
              credits: 500,
              renews: true,
            },
          ],
        };

        const result = await service.updateEntitlements(sampleTenant.id, dto, 'user-admin-1');

        expect(mockRepo.upsertEntitlement).toHaveBeenCalledWith(
          sampleTenant.id,
          dto.overrides![0],
          'user-admin-1',
        );
        expect(mockRepo.assignAddon).toHaveBeenCalledWith(sampleTenant.id, dto.addons![0]);
        expect(result.entitlements).toEqual([sampleEntitlement]);
        expect(result.addons).toEqual([sampleAddon]);
        expect(result.message).toBe(TENANTS_MESSAGES.ENTITLEMENTS_UPDATED);
      });

      it('should retrieve existing entitlements and addons for a tenant', async () => {
        mockRepo.findById.mockResolvedValue(sampleTenant);
        mockRepo.findEntitlements.mockResolvedValue([sampleEntitlement]);
        mockRepo.findAddons.mockResolvedValue([sampleAddon]);

        const result = await service.getEntitlements(sampleTenant.id);

        expect(result.tenant).toEqual(sampleTenant);
        expect(result.entitlements).toEqual([sampleEntitlement]);
        expect(result.addons).toEqual([sampleAddon]);
      });
    });
  });

  describe('TenantsController', () => {
    it('should delegate findAll to service.findAll for admin route and return paginated object', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue({
        items: [sampleTenant],
        total: 1,
        limit: 20,
        offset: 0,
        page: 1,
        data: [sampleTenant],
      });

      const query: FindTenantsQueryDto = { status: 'active', search: 'Acme' };
      const mockReq = { baseUrl: '/api/v1/admin/tenants' } as any;
      const result = await controller.findAll(query, mockReq);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect((result as any).items).toHaveLength(1);
    });

    it('should return raw array when legacy /platform/tenants is called without query params', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue({
        items: [sampleTenant],
        total: 1,
        limit: 20,
        offset: 0,
        page: 1,
        data: [sampleTenant],
      });

      const mockReq = { baseUrl: '/api/v1/platform/tenants' } as any;
      const result = await controller.findAll({}, mockReq);

      expect(service.findAll).toHaveBeenCalledWith({});
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('should delegate findOne to service.findByIdOrSlug', async () => {
      vi.spyOn(service, 'findByIdOrSlug').mockResolvedValue(sampleTenant);

      const result = await controller.findOne('acme-beauty');

      expect(service.findByIdOrSlug).toHaveBeenCalledWith('acme-beauty');
      expect(result).toEqual(sampleTenant);
    });

    it('should delegate create to service.create', async () => {
      vi.spyOn(service, 'create').mockResolvedValue(sampleTenant);

      const dto: CreateTenantDto = {
        name: 'Acme Beauty',
        slug: 'acme-beauty',
        vertical: 'services',
      };
      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(sampleTenant);
    });

    it('should delegate update to service.update', async () => {
      vi.spyOn(service, 'update').mockResolvedValue({ ...sampleTenant, name: 'Acme New' });

      const dto: UpdateTenantDto = { name: 'Acme New' };
      const result = await controller.update(sampleTenant.id, dto);

      expect(service.update).toHaveBeenCalledWith(sampleTenant.id, dto);
      expect(result.name).toBe('Acme New');
    });

    it('should delegate updateStatus to service.updateStatus', async () => {
      vi.spyOn(service, 'updateStatus').mockResolvedValue({
        ...sampleTenant,
        status: 'suspended',
        isActive: false,
      });

      const dto: UpdateTenantStatusDto = { status: 'suspended' };
      const result = await controller.updateStatus(sampleTenant.id, dto);

      expect(service.updateStatus).toHaveBeenCalledWith(sampleTenant.id, dto);
      expect(result.status).toBe('suspended');
    });

    it('should delegate updateEntitlements to service.updateEntitlements with actor sub', async () => {
      vi.spyOn(service, 'updateEntitlements').mockResolvedValue({
        tenant: sampleTenant,
        entitlements: [sampleEntitlement],
        addons: [sampleAddon],
        message: TENANTS_MESSAGES.ENTITLEMENTS_UPDATED,
      });

      const dto: UpdateTenantEntitlementsDto = {
        overrides: [
          {
            capabilityKey: 'services.bookings.photo_upload',
            effect: 'allow',
          },
        ],
      };
      const mockReq = { user: { sub: 'actor-user-id' } } as any;

      const result = await controller.updateEntitlements(sampleTenant.id, dto, mockReq);

      expect(service.updateEntitlements).toHaveBeenCalledWith(
        sampleTenant.id,
        dto,
        'actor-user-id',
      );
      expect(result.entitlements).toHaveLength(1);
    });

    it('should delegate getEntitlements to service.getEntitlements', async () => {
      vi.spyOn(service, 'getEntitlements').mockResolvedValue({
        tenant: sampleTenant,
        entitlements: [sampleEntitlement],
        addons: [sampleAddon],
      });

      const result = await controller.getEntitlements(sampleTenant.id);

      expect(service.getEntitlements).toHaveBeenCalledWith(sampleTenant.id);
      expect(result.entitlements).toHaveLength(1);
    });
  });

  describe('DTO Validation & Transformation', () => {
    it('should validate and transform FindTenantsQueryDto', async () => {
      const dto = plainToInstance(FindTenantsQueryDto, {
        search: '  Acme Salon  ',
        status: 'ACTIVE ',
        plan: ' pro ',
        limit: '25',
        offset: '50',
        page: '3',
        sortOrder: 'DESC',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.search).toBe('Acme Salon');
      expect(dto.status).toBe('active');
      expect(dto.plan).toBe('pro');
      expect(dto.limit).toBe(25);
      expect(dto.offset).toBe(50);
      expect(dto.page).toBe(3);
      expect(dto.sortOrder).toBe('desc');
    });

    it('should validate CreateTenantDto and normalize slug', async () => {
      const dto = plainToInstance(CreateTenantDto, {
        name: '  Acme Beauty  ',
        slug: 'Acme-Salon-2026',
        vertical: ' Services ',
        planKey: 'pro',
      });

      expect(dto.slug).toBe('acme-salon-2026');
      expect(dto.vertical).toBe('services');
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid slug format in CreateTenantDto', async () => {
      const invalidSlugs = ['Invalid slug with spaces', 'slug$invalid!', 'a'];
      for (const invalidSlug of invalidSlugs) {
        const dto = plainToInstance(CreateTenantDto, {
          name: 'Acme',
          slug: invalidSlug,
          vertical: 'services',
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should validate UpdateTenantStatusDto with active or suspended', async () => {
      const validDto = plainToInstance(UpdateTenantStatusDto, { status: 'SUSPENDED' });
      expect(validDto.status).toBe('suspended');
      const errors = await validate(validDto);
      expect(errors).toHaveLength(0);

      const invalidDto = plainToInstance(UpdateTenantStatusDto, { status: 'invalid_status' as any });
      const invalidErrors = await validate(invalidDto);
      expect(invalidErrors.length).toBeGreaterThan(0);
    });

    it('should validate UpdateTenantEntitlementsDto with allow and deny effects', async () => {
      const validDto = plainToInstance(UpdateTenantEntitlementsDto, {
        overrides: [
          {
            capabilityKey: 'services.bookings.photo_upload',
            effect: 'allow',
            reason: 'Beta tester',
          },
          {
            capabilityKey: 'commerce.catalog.variants',
            effect: 'deny',
          },
        ],
        addons: [
          {
            addonKey: 'credits_100',
            credits: 100,
            renews: true,
          },
        ],
      });

      const errors = await validate(validDto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid effect in CapabilityOverrideDto', async () => {
      const invalidDto = plainToInstance(CapabilityOverrideDto, {
        capabilityKey: 'services.bookings.photo_upload',
        effect: 'maybe' as any,
      });

      const errors = await validate(invalidDto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('TenantsRepository Integration Logic', () => {
    it('should properly handle ObjectId vs slug in findByIdOrSlug', async () => {
      const mockPrisma = {
        platformTenant: {
          findUnique: vi.fn(),
        },
      };

      const repo = new TenantsRepository(mockPrisma as any);

      // 24-character hex ObjectId
      const objectId = '65f1a2b3c4d5e6f7a8b9c0d1';
      mockPrisma.platformTenant.findUnique.mockResolvedValueOnce(sampleTenant);
      const resById = await repo.findByIdOrSlug(objectId);
      expect(mockPrisma.platformTenant.findUnique).toHaveBeenCalledWith({
        where: { id: objectId },
        select: expect.any(Object),
      });
      expect(resById).toEqual(sampleTenant);

      // Slug string
      const slug = 'acme-beauty';
      mockPrisma.platformTenant.findUnique.mockResolvedValueOnce(sampleTenant);
      const resBySlug = await repo.findByIdOrSlug(slug);
      expect(mockPrisma.platformTenant.findUnique).toHaveBeenCalledWith({
        where: { slug },
        select: expect.any(Object),
      });
      expect(resBySlug).toEqual(sampleTenant);
    });
  });
});
