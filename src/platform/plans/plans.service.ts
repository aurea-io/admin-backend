import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PlanStatus, Prisma } from '@prisma/client';
import { PlansRepository } from './plans.repository.js';
import { PLANS_MESSAGES } from './plans.constants.js';
import type {
  CreatePlanDto,
  FindPlansQueryDto,
  UpdatePlanDto,
  UpdatePlanStatusDto,
} from './dto/index.js';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly repository: PlansRepository) {}

  /**
   * Lists commercial plans matching optional query filters, pagination, and sorting.
   */
  async findAll(query: FindPlansQueryDto) {
    const filters = {
      status: query.status,
      search: query.search,
      includeArchived: query.includeArchived,
    };

    const pagination = {
      limit: query.limit,
      offset: query.offset,
    };

    const sort = {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    return this.repository.findAll(filters, pagination, sort);
  }

  /**
   * Retrieves a single plan by its ID or key. Throws NotFoundException if missing.
   */
  async findByIdOrKey(idOrKey: string) {
    const plan = await this.repository.findByIdOrKey(idOrKey);
    if (!plan) {
      throw new NotFoundException(PLANS_MESSAGES.NOT_FOUND);
    }
    return plan;
  }

  /**
   * Creates a new commercial plan.
   */
  async create(dto: CreatePlanDto) {
    try {
      const status = dto.status ?? PlanStatus.draft;
      const isActive = dto.isActive ?? (status === PlanStatus.active);

      const plan = await this.repository.create({
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        status,
        displayOrder: dto.displayOrder ?? 0,
        includedFeatures: dto.includedFeatures ?? [],
        prices: dto.prices ?? [],
        credits: dto.credits
          ? {
              monthly: dto.credits.monthly ?? 0,
              rollover: dto.credits.rollover ?? false,
            }
          : undefined,
        limits: dto.limits ?? undefined,
        trialDays: dto.trialDays ?? 0,
        gracePeriodDays: dto.gracePeriodDays ?? 3,
        isPopular: dto.isPopular ?? false,
        isActive,
      });

      this.logger.log(`Created commercial plan '${plan.key}' (ID: ${plan.id}, status: ${plan.status})`);
      return plan;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(PLANS_MESSAGES.KEY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Updates an existing commercial plan and increments its version counter.
   */
  async update(idOrKey: string, dto: UpdatePlanDto) {
    const existing = await this.findByIdOrKey(idOrKey);

    try {
      const updateData: Prisma.PlatformPlanUpdateInput = {};

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.status !== undefined) {
        updateData.status = dto.status;
        updateData.isActive = dto.status === PlanStatus.active;
      }
      if (dto.displayOrder !== undefined) updateData.displayOrder = dto.displayOrder;
      if (dto.includedFeatures !== undefined) updateData.includedFeatures = dto.includedFeatures;
      if (dto.prices !== undefined) updateData.prices = dto.prices;
      if (dto.credits !== undefined) {
        updateData.credits = {
          monthly: dto.credits.monthly ?? 0,
          rollover: dto.credits.rollover ?? false,
        };
      }
      if (dto.limits !== undefined) updateData.limits = dto.limits;
      if (dto.trialDays !== undefined) updateData.trialDays = dto.trialDays;
      if (dto.gracePeriodDays !== undefined) updateData.gracePeriodDays = dto.gracePeriodDays;
      if (dto.isPopular !== undefined) updateData.isPopular = dto.isPopular;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      const updated = await this.repository.updateById(existing.id, updateData);

      this.logger.log(`Updated plan '${existing.key}' (version -> ${updated.version})`);
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(PLANS_MESSAGES.KEY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Updates the lifecycle status of a plan (e.g., draft, active, archived).
   */
  async updateStatus(idOrKey: string, dto: UpdatePlanStatusDto) {
    const existing = await this.findByIdOrKey(idOrKey);
    const updated = await this.repository.updateStatus(existing.id, dto.status);

    this.logger.log(
      `Status updated for plan '${existing.key}': ${existing.status} -> ${dto.status} (version -> ${updated.version})`,
    );
    return updated;
  }

  /**
   * Soft-archives a plan (status='archived', isActive=false).
   */
  async archive(idOrKey: string) {
    const existing = await this.findByIdOrKey(idOrKey);
    const updated = await this.repository.archive(existing.id);

    this.logger.log(`Archived plan '${existing.key}' (ID: ${existing.id})`);
    return updated;
  }
}
