import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PlanBillingInterval, PlanStatus, Prisma } from '@prisma/client';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PlansService } from '../src/platform/plans/plans.service.js';
import { PlansController } from '../src/platform/plans/plans.controller.js';
import { PlansRepository } from '../src/platform/plans/plans.repository.js';
import {
  CreatePlanDto,
  FindPlansQueryDto,
  PlanPriceDto,
  PlanCreditsDto,
  UpdatePlanDto,
  UpdatePlanStatusDto,
} from '../src/platform/plans/dto/index.js';
import { PLANS_MESSAGES } from '../src/platform/plans/plans.constants.js';

describe('Commercial Plans Management Domain', () => {
  let service: PlansService;
  let controller: PlansController;
  let mockRepo: Record<keyof PlansRepository, any>;

  const samplePlan = {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    key: 'pro',
    name: 'Pro Tier',
    description: 'Professional commercial plan with advanced capabilities',
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
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findByIdOrKey: vi.fn(),
      findByKey: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateById: vi.fn(),
      updateByKey: vi.fn(),
      updateStatus: vi.fn(),
      archive: vi.fn(),
    } as any;

    service = new PlansService(mockRepo as unknown as PlansRepository);
    controller = new PlansController(service);
  });

  describe('PlansService', () => {
    describe('findAll', () => {
      it('should delegate to repository.findAll with mapped filters and pagination', async () => {
        mockRepo.findAll.mockResolvedValue({
          items: [samplePlan],
          total: 1,
          limit: 20,
          offset: 0,
        });

        const query: FindPlansQueryDto = {
          status: PlanStatus.active,
          search: 'Pro',
          limit: 20,
          offset: 0,
        };

        const result = await service.findAll(query);

        expect(mockRepo.findAll).toHaveBeenCalledWith(
          { status: PlanStatus.active, search: 'Pro', includeArchived: undefined },
          { limit: 20, offset: 0 },
          { sortBy: undefined, sortOrder: undefined },
        );
        expect(result.items).toEqual([samplePlan]);
        expect(result.total).toBe(1);
      });
    });

    describe('findByIdOrKey', () => {
      it('should return the plan when found by key or ID', async () => {
        mockRepo.findByIdOrKey.mockResolvedValue(samplePlan);

        const result = await service.findByIdOrKey('pro');

        expect(mockRepo.findByIdOrKey).toHaveBeenCalledWith('pro');
        expect(result).toEqual(samplePlan);
      });

      it('should throw NotFoundException when plan does not exist', async () => {
        mockRepo.findByIdOrKey.mockResolvedValue(null);

        await expect(service.findByIdOrKey('non-existent')).rejects.toThrow(NotFoundException);
        await expect(service.findByIdOrKey('non-existent')).rejects.toThrow(PLANS_MESSAGES.NOT_FOUND);
      });
    });

    describe('create', () => {
      it('should create a plan with normalized defaults and return the result', async () => {
        const dto: CreatePlanDto = {
          key: 'starter',
          name: 'Starter Plan',
          description: 'Basic entry tier',
          status: PlanStatus.active,
          displayOrder: 0,
          includedFeatures: ['services.bookings.create'],
          prices: [
            {
              currency: 'USD',
              amount: 19.99,
              interval: PlanBillingInterval.monthly,
              isActive: true,
            },
          ],
          credits: {
            monthly: 100,
            rollover: false,
          },
          trialDays: 7,
          gracePeriodDays: 3,
        };

        mockRepo.create.mockResolvedValue({
          ...samplePlan,
          ...dto,
          id: '65f1a2b3c4d5e6f7a8b9c0d9',
          version: 1,
          isActive: true,
        });

        const result = await service.create(dto);

        expect(mockRepo.create).toHaveBeenCalledWith({
          key: 'starter',
          name: 'Starter Plan',
          description: 'Basic entry tier',
          status: PlanStatus.active,
          displayOrder: 0,
          includedFeatures: ['services.bookings.create'],
          prices: dto.prices,
          credits: { monthly: 100, rollover: false },
          limits: undefined,
          trialDays: 7,
          gracePeriodDays: 3,
          isPopular: false,
          isActive: true,
        });
        expect(result.key).toBe('starter');
      });

      it('should map Prisma P2002 unique constraint error to ConflictException', async () => {
        const dto: CreatePlanDto = {
          key: 'pro',
          name: 'Pro Duplicate',
        };

        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint violation',
          { code: 'P2002', clientVersion: '6.x' },
        );
        mockRepo.create.mockRejectedValue(prismaError);

        await expect(service.create(dto)).rejects.toThrow(ConflictException);
        await expect(service.create(dto)).rejects.toThrow(PLANS_MESSAGES.KEY_EXISTS);
      });
    });

    describe('update', () => {
      it('should update plan metadata and return updated entity with incremented version', async () => {
        mockRepo.findByIdOrKey.mockResolvedValue(samplePlan);
        mockRepo.updateById.mockResolvedValue({
          ...samplePlan,
          name: 'Pro Tier Updated',
          version: 2,
        });

        const dto: UpdatePlanDto = {
          name: 'Pro Tier Updated',
        };

        const result = await service.update('pro', dto);

        expect(mockRepo.findByIdOrKey).toHaveBeenCalledWith('pro');
        expect(mockRepo.updateById).toHaveBeenCalledWith(samplePlan.id, {
          name: 'Pro Tier Updated',
        });
        expect(result.name).toBe('Pro Tier Updated');
        expect(result.version).toBe(2);
      });

      it('should map P2002 error to ConflictException during update', async () => {
        mockRepo.findByIdOrKey.mockResolvedValue(samplePlan);
        const prismaError = new Prisma.PrismaClientKnownRequestError(
          'Unique constraint violation',
          { code: 'P2002', clientVersion: '6.x' },
        );
        mockRepo.updateById.mockRejectedValue(prismaError);

        await expect(service.update('pro', { name: 'New Name' })).rejects.toThrow(
          ConflictException,
        );
      });
    });

    describe('updateStatus', () => {
      it('should update status and sync isActive state', async () => {
        mockRepo.findByIdOrKey.mockResolvedValue(samplePlan);
        mockRepo.updateStatus.mockResolvedValue({
          ...samplePlan,
          status: PlanStatus.archived,
          isActive: false,
          version: 2,
        });

        const dto: UpdatePlanStatusDto = { status: PlanStatus.archived };
        const result = await service.updateStatus('pro', dto);

        expect(mockRepo.updateStatus).toHaveBeenCalledWith(samplePlan.id, PlanStatus.archived);
        expect(result.status).toBe(PlanStatus.archived);
        expect(result.isActive).toBe(false);
      });
    });

    describe('archive', () => {
      it('should soft-archive an existing plan', async () => {
        mockRepo.findByIdOrKey.mockResolvedValue(samplePlan);
        mockRepo.archive.mockResolvedValue({
          ...samplePlan,
          status: PlanStatus.archived,
          isActive: false,
          version: 2,
        });

        const result = await service.archive('pro');

        expect(mockRepo.findByIdOrKey).toHaveBeenCalledWith('pro');
        expect(mockRepo.archive).toHaveBeenCalledWith(samplePlan.id);
        expect(result.status).toBe(PlanStatus.archived);
      });
    });
  });

  describe('PlansController', () => {
    it('should delegate findAll to service.findAll', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue({
        items: [samplePlan],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const query: FindPlansQueryDto = { status: PlanStatus.active };
      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.items).toHaveLength(1);
    });

    it('should delegate findOne to service.findByIdOrKey', async () => {
      vi.spyOn(service, 'findByIdOrKey').mockResolvedValue(samplePlan);

      const result = await controller.findOne('pro');

      expect(service.findByIdOrKey).toHaveBeenCalledWith('pro');
      expect(result).toEqual(samplePlan);
    });

    it('should delegate create to service.create', async () => {
      vi.spyOn(service, 'create').mockResolvedValue(samplePlan);

      const dto: CreatePlanDto = { key: 'pro', name: 'Pro Tier' };
      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(samplePlan);
    });

    it('should delegate update to service.update', async () => {
      vi.spyOn(service, 'update').mockResolvedValue({ ...samplePlan, name: 'Pro Tier 2' });

      const dto: UpdatePlanDto = { name: 'Pro Tier 2' };
      const result = await controller.update('pro', dto);

      expect(service.update).toHaveBeenCalledWith('pro', dto);
      expect(result.name).toBe('Pro Tier 2');
    });

    it('should delegate updateStatus to service.updateStatus', async () => {
      vi.spyOn(service, 'updateStatus').mockResolvedValue({
        ...samplePlan,
        status: PlanStatus.draft,
      });

      const dto: UpdatePlanStatusDto = { status: PlanStatus.draft };
      const result = await controller.updateStatus('pro', dto);

      expect(service.updateStatus).toHaveBeenCalledWith('pro', dto);
      expect(result.status).toBe(PlanStatus.draft);
    });

    it('should delegate archive to service.archive', async () => {
      vi.spyOn(service, 'archive').mockResolvedValue({
        ...samplePlan,
        status: PlanStatus.archived,
      });

      const result = await controller.archive('pro');

      expect(service.archive).toHaveBeenCalledWith('pro');
      expect(result.status).toBe(PlanStatus.archived);
    });
  });

  describe('DTO Validation & Transformation', () => {
    it('should successfully validate valid CreatePlanDto', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        key: 'enterprise-custom_2026',
        name: 'Enterprise Plan',
        description: 'Large enterprise solution',
        status: PlanStatus.active,
        displayOrder: 2,
        includedFeatures: ['services.bookings.create', 'services.bookings.photo_upload'],
        prices: [
          {
            currency: 'usd',
            amount: 99.99,
            interval: PlanBillingInterval.yearly,
            isActive: true,
          },
        ],
        credits: {
          monthly: 1000,
          rollover: true,
        },
        trialDays: 30,
        gracePeriodDays: 7,
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.key).toBe('enterprise-custom_2026');
      expect(dto.prices?.[0]?.currency).toBe('USD');
    });

    it('should normalize uppercase keys and trim whitespaces in CreatePlanDto', async () => {
      const dto = plainToInstance(CreatePlanDto, {
        key: '  PRO_COMMERCIAL-2026  ',
        name: '  Pro Tier  ',
      });

      expect(dto.key).toBe('pro_commercial-2026');
      expect(dto.name).toBe('Pro Tier');
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid key formats in CreatePlanDto', async () => {
      const invalidKeys = ['Invalid Key with spaces', 'pro$special!', 'p', ''];

      for (const invalidKey of invalidKeys) {
        const dto = plainToInstance(CreatePlanDto, {
          key: invalidKey,
          name: 'Invalid Plan',
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
      }
    });

    it('should reject negative price amounts and invalid intervals in PlanPriceDto', async () => {
      const priceDto = plainToInstance(PlanPriceDto, {
        currency: 'USD',
        amount: -10,
        interval: 'bi-weekly' as any,
      });

      const errors = await validate(priceDto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative monthly credits in PlanCreditsDto', async () => {
      const creditsDto = plainToInstance(PlanCreditsDto, {
        monthly: -5,
        rollover: true,
      });

      const errors = await validate(creditsDto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('PlansRepository Integration Logic', () => {
    it('should properly handle ObjectId vs key in findByIdOrKey', async () => {
      const mockPrisma = {
        platformPlan: {
          findUnique: vi.fn(),
        },
      };

      const repo = new PlansRepository(mockPrisma as any);

      // 24 hex chars ObjectId
      const objectId = '65f1a2b3c4d5e6f7a8b9c0d1';
      mockPrisma.platformPlan.findUnique.mockResolvedValueOnce(samplePlan);
      const resById = await repo.findByIdOrKey(objectId);
      expect(mockPrisma.platformPlan.findUnique).toHaveBeenCalledWith({
        where: { id: objectId },
        select: expect.any(Object),
      });
      expect(resById).toEqual(samplePlan);

      // Slug key
      const key = 'pro-tier';
      mockPrisma.platformPlan.findUnique.mockResolvedValueOnce(samplePlan);
      const resByKey = await repo.findByIdOrKey(key);
      expect(mockPrisma.platformPlan.findUnique).toHaveBeenCalledWith({
        where: { key },
        select: expect.any(Object),
      });
      expect(resByKey).toEqual(samplePlan);
    });
  });
});
