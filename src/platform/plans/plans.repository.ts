import { Injectable } from '@nestjs/common';
import type { PlanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PLANS_PAGINATION, PLAN_SAFE_SELECT } from './plans.constants.js';

export interface PlanFilters {
  status?: PlanStatus;
  search?: string;
  includeArchived?: boolean;
}

export interface PlanPagination {
  limit?: number;
  offset?: number;
}

export interface PlanSort {
  sortBy?: 'displayOrder' | 'name' | 'createdAt' | 'key' | 'status';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) { }

  private isObjectId(val: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(val);
  }

  /**
   * Find a plan by its unique id or its unique key.
   */
  async findByIdOrKey(idOrKey: string) {
    if (this.isObjectId(idOrKey)) {
      const planById = await this.prisma.platformPlan.findUnique({
        where: { id: idOrKey },
        select: PLAN_SAFE_SELECT,
      });
      if (planById) return planById;
    }

    return this.prisma.platformPlan.findUnique({
      where: { key: idOrKey },
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * Find a plan specifically by its key.
   */
  findByKey(key: string) {
    return this.prisma.platformPlan.findUnique({
      where: { key },
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * Find a plan specifically by its MongoDB ObjectId.
   */
  findById(id: string) {
    return this.prisma.platformPlan.findUnique({
      where: { id },
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * List plans matching optional filters, with pagination and custom sorting.
   */
  async findAll(
    filters: PlanFilters = {},
    pagination: PlanPagination = {},
    sort: PlanSort = {},
  ) {
    const where = this.buildWhereClause(filters);
    const limit = pagination.limit ?? PLANS_PAGINATION.DEFAULT_LIMIT;
    const offset = pagination.offset ?? PLANS_PAGINATION.DEFAULT_OFFSET;
    const sortBy = sort.sortBy ?? 'displayOrder';
    const sortOrder = sort.sortOrder ?? 'asc';

    const [items, total] = await Promise.all([
      this.prisma.platformPlan.findMany({
        where,
        select: PLAN_SAFE_SELECT,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.platformPlan.count({ where }),
    ]);

    return {
      items,
      total,
      limit,
      offset,
    };
  }

  /**
   * Creates a new commercial plan.
   */
  create(data: Prisma.PlatformPlanCreateInput) {
    return this.prisma.platformPlan.create({
      data,
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * Updates an existing plan by its ID and increments the version counter.
   */
  updateById(id: string, data: Prisma.PlatformPlanUpdateInput) {
    return this.prisma.platformPlan.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 },
      },
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * Updates an existing plan by its unique key and increments the version counter.
   */
  updateByKey(key: string, data: Prisma.PlatformPlanUpdateInput) {
    return this.prisma.platformPlan.update({
      where: { key },
      data: {
        ...data,
        version: { increment: 1 },
      },
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * Updates status directly (e.g. active, draft, archived) without full metadata rewrite.
   */
  updateStatus(id: string, status: PlanStatus) {
    return this.prisma.platformPlan.update({
      where: { id },
      data: {
        status,
        isActive: status === 'active',
        version: { increment: 1 },
      },
      select: PLAN_SAFE_SELECT,
    });
  }

  /**
   * Soft-archives a plan by setting status='archived' and isActive=false.
   */
  archive(id: string) {
    return this.prisma.platformPlan.update({
      where: { id },
      data: {
        status: 'archived',
        isActive: false,
        version: { increment: 1 },
      },
      select: PLAN_SAFE_SELECT,
    });
  }

  private buildWhereClause(filters: PlanFilters): Prisma.PlatformPlanWhereInput {
    const where: Prisma.PlatformPlanWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    } else if (!filters.includeArchived) {
      where.status = { not: 'archived' };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { key: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}
