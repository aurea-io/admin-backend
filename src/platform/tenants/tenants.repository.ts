import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TENANTS_PAGINATION, TENANT_SAFE_SELECT } from './tenants.constants.js';
import type { CapabilityOverrideDto, TenantAddonAssignmentDto } from './dto/index.js';

export interface TenantFilters {
  search?: string;
  status?: string;
  plan?: string;
  isActive?: boolean;
}

export interface TenantPagination {
  limit?: number;
  offset?: number;
}

export interface TenantSort {
  sortBy?: 'name' | 'slug' | 'createdAt' | 'vertical' | 'status';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private isObjectId(val: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(val);
  }

  /**
   * Find a tenant by its MongoDB ObjectId or unique slug.
   */
  async findByIdOrSlug(idOrSlug: string) {
    if (this.isObjectId(idOrSlug)) {
      const tenantById = await this.prisma.platformTenant.findUnique({
        where: { id: idOrSlug },
        select: TENANT_SAFE_SELECT,
      });
      if (tenantById) return tenantById;
    }

    return this.prisma.platformTenant.findUnique({
      where: { slug: idOrSlug.toLowerCase().trim() },
      select: TENANT_SAFE_SELECT,
    });
  }

  /**
   * Find a tenant specifically by its MongoDB ObjectId.
   */
  findById(id: string) {
    return this.prisma.platformTenant.findUnique({
      where: { id },
      select: TENANT_SAFE_SELECT,
    });
  }

  /**
   * Find a tenant specifically by its unique slug.
   */
  findBySlug(slug: string) {
    return this.prisma.platformTenant.findUnique({
      where: { slug: slug.toLowerCase().trim() },
      select: TENANT_SAFE_SELECT,
    });
  }

  /**
   * List tenants matching filters, pagination, and sorting.
   */
  async findAll(
    filters: TenantFilters = {},
    pagination: TenantPagination = {},
    sort: TenantSort = {},
  ) {
    const andClauses: any[] = [];

    if (filters.search) {
      andClauses.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.status) {
      const normalizedStatus = filters.status.toLowerCase().trim();
      if (normalizedStatus === 'active' || normalizedStatus === 'true') {
        andClauses.push({
          OR: [{ status: 'active' }, { isActive: true }],
        });
      } else if (normalizedStatus === 'suspended' || normalizedStatus === 'false') {
        andClauses.push({
          OR: [{ status: 'suspended' }, { isActive: false }],
        });
      } else {
        andClauses.push({ status: normalizedStatus });
      }
    }

    if (filters.isActive !== undefined) {
      andClauses.push({ isActive: filters.isActive });
    }

    if (filters.plan) {
      const planKey = filters.plan.trim();
      const subscriptions = await this.prisma.tenantSubscription.findMany({
        where: { planKey, status: 'active' },
        select: { tenantId: true },
      });
      const subscribedTenantIds = subscriptions.map((s) => s.tenantId);

      andClauses.push({
        OR: [
          { planKey },
          { id: { in: subscribedTenantIds } },
        ],
      });
    }

    const where: Prisma.PlatformTenantWhereInput =
      andClauses.length > 0 ? { AND: andClauses } : {};

    const limit = pagination.limit ?? TENANTS_PAGINATION.DEFAULT_LIMIT;
    const offset = pagination.offset ?? TENANTS_PAGINATION.DEFAULT_OFFSET;
    const sortBy = sort.sortBy ?? 'createdAt';
    const sortOrder = sort.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.platformTenant.findMany({
        where,
        select: TENANT_SAFE_SELECT,
        orderBy: [{ [sortBy]: sortOrder }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.platformTenant.count({ where }),
    ]);

    const page = Math.floor(offset / limit) + 1;

    return {
      items,
      total,
      limit,
      offset,
      page,
      data: items, // convenience alias for frontend flexibility
    };
  }

  /**
   * Creates a new tenant.
   */
  create(data: Prisma.PlatformTenantCreateInput) {
    return this.prisma.platformTenant.create({
      data,
      select: TENANT_SAFE_SELECT,
    });
  }

  /**
   * Updates an existing tenant by ID.
   */
  updateById(id: string, data: Prisma.PlatformTenantUpdateInput) {
    return this.prisma.platformTenant.update({
      where: { id },
      data,
      select: TENANT_SAFE_SELECT,
    });
  }

  /**
   * Updates lifecycle status (e.g. active/suspended) of a tenant.
   */
  updateStatus(id: string, status: string, isActive: boolean) {
    return this.prisma.platformTenant.update({
      where: { id },
      data: {
        status,
        isActive,
      },
      select: TENANT_SAFE_SELECT,
    });
  }

  /**
   * Upserts a capability override in tenant_entitlements collection.
   */
  async upsertEntitlement(
    tenantId: string,
    override: CapabilityOverrideDto,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.tenantEntitlement.findUnique({
      where: {
        tenantId_capabilityKey: {
          tenantId,
          capabilityKey: override.capabilityKey,
        },
      },
    });

    if (existing) {
      return this.prisma.tenantEntitlement.update({
        where: { id: existing.id },
        data: {
          effect: override.effect,
          source: override.source ?? 'owner_override',
          reason: override.reason ?? existing.reason,
          changedBy: actorUserId ?? existing.changedBy,
          version: { increment: 1 },
        },
      });
    }

    return this.prisma.tenantEntitlement.create({
      data: {
        tenantId,
        capabilityKey: override.capabilityKey,
        effect: override.effect,
        source: override.source ?? 'owner_override',
        reason: override.reason ?? null,
        changedBy: actorUserId ?? null,
        version: 1,
      },
    });
  }

  /**
   * Assigns or updates a tenant addon.
   */
  async assignAddon(tenantId: string, addon: TenantAddonAssignmentDto) {
    const existing = await this.prisma.tenantAddon.findFirst({
      where: {
        tenantId,
        addonKey: addon.addonKey,
      },
    });

    if (existing) {
      return this.prisma.tenantAddon.update({
        where: { id: existing.id },
        data: {
          credits: addon.credits,
          status: addon.status ?? 'active',
          renews: addon.renews ?? existing.renews,
          validUntil: addon.validUntil ?? existing.validUntil,
        },
      });
    }

    return this.prisma.tenantAddon.create({
      data: {
        tenantId,
        addonKey: addon.addonKey,
        credits: addon.credits,
        status: addon.status ?? 'active',
        renews: addon.renews ?? true,
        validUntil: addon.validUntil ?? null,
      },
    });
  }

  /**
   * Retrieves all overrides/entitlements configured for a tenant.
   */
  findEntitlements(tenantId: string) {
    return this.prisma.tenantEntitlement.findMany({
      where: { tenantId },
      orderBy: { capabilityKey: 'asc' },
    });
  }

  /**
   * Retrieves all addons assigned to a tenant.
   */
  findAddons(tenantId: string) {
    return this.prisma.tenantAddon.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
