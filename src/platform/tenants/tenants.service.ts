import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantsRepository } from './tenants.repository.js';
import { TENANTS_MESSAGES } from './tenants.constants.js';
import type {
  CreateTenantDto,
  FindTenantsQueryDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
  UpdateTenantEntitlementsDto,
} from './dto/index.js';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly repository: TenantsRepository) {}

  /**
   * Lists tenants matching filters, pagination, and sorting.
   */
  async findAll(query: FindTenantsQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? (query.page ? (query.page - 1) * limit : 0);

    const filters = {
      search: query.search,
      status: query.status,
      plan: query.plan,
      isActive: query.isActive,
    };

    const pagination = {
      limit,
      offset,
    };

    const sort = {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    return this.repository.findAll(filters, pagination, sort);
  }

  /**
   * Finds a tenant by ID or slug, or throws NotFoundException.
   */
  async findByIdOrSlug(idOrSlug: string) {
    const tenant = await this.repository.findByIdOrSlug(idOrSlug);
    if (!tenant) {
      throw new NotFoundException(TENANTS_MESSAGES.NOT_FOUND);
    }
    return tenant;
  }

  /**
   * Finds a tenant by MongoDB ID, or throws NotFoundException.
   */
  async findById(id: string) {
    const tenant = await this.repository.findById(id);
    if (!tenant) {
      throw new NotFoundException(TENANTS_MESSAGES.NOT_FOUND);
    }
    return tenant;
  }

  /**
   * Creates a new client tenant.
   */
  async create(dto: CreateTenantDto) {
    try {
      const slug = dto.slug.toLowerCase().trim();
      const tenant = await this.repository.create({
        name: dto.name.trim(),
        slug,
        vertical: dto.vertical.toLowerCase().trim(),
        planKey: dto.planKey ? dto.planKey.trim() : null,
        status: 'active',
        isActive: true,
      });

      this.logger.log(`Created tenant '${tenant.slug}' (ID: ${tenant.id})`);
      return tenant;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(TENANTS_MESSAGES.SLUG_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Updates an existing tenant.
   */
  async update(id: string, dto: UpdateTenantDto) {
    const existing = await this.findById(id);

    try {
      const updateData: Prisma.PlatformTenantUpdateInput = {};

      if (dto.name !== undefined) updateData.name = dto.name.trim();
      if (dto.vertical !== undefined) updateData.vertical = dto.vertical.toLowerCase().trim();
      if (dto.planKey !== undefined) updateData.planKey = dto.planKey ? dto.planKey.trim() : null;
      if (dto.maintenanceMode !== undefined) updateData.maintenanceMode = dto.maintenanceMode;
      if (dto.maintenanceMessage !== undefined) updateData.maintenanceMessage = dto.maintenanceMessage;

      if (dto.status !== undefined) {
        const normalized = dto.status.toLowerCase().trim();
        updateData.status = normalized;
        updateData.isActive = normalized === 'active';
      } else if (dto.isActive !== undefined) {
        updateData.isActive = dto.isActive;
        updateData.status = dto.isActive ? 'active' : 'suspended';
      }

      const updated = await this.repository.updateById(existing.id, updateData);
      this.logger.log(`Updated tenant '${existing.slug}' (ID: ${existing.id})`);
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(TENANTS_MESSAGES.SLUG_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Suspends or reactivates a tenant.
   * Endpoint: PATCH /api/v1/admin/tenants/:id/status
   */
  async updateStatus(id: string, dto: UpdateTenantStatusDto) {
    const existing = await this.findById(id);

    let nextStatus = 'active';
    let nextIsActive = true;

    if (dto.status !== undefined) {
      nextStatus = dto.status;
      nextIsActive = dto.status === 'active';
    } else if (dto.isActive !== undefined) {
      nextIsActive = dto.isActive;
      nextStatus = dto.isActive ? 'active' : 'suspended';
    }

    const updated = await this.repository.updateStatus(
      existing.id,
      nextStatus,
      nextIsActive,
    );

    this.logger.log(
      `Tenant status changed for '${existing.slug}': ${existing.status} -> ${nextStatus} (isActive: ${nextIsActive})`,
    );

    return updated;
  }

  /**
   * Applies capability overrides (allow / deny) and assigns addons.
   * Endpoint: PUT /api/v1/admin/tenants/:id/entitlements
   */
  async updateEntitlements(
    id: string,
    dto: UpdateTenantEntitlementsDto,
    actorUserId?: string,
  ) {
    const existing = await this.findById(id);

    const overridesToApply = [
      ...(dto.overrides ?? []),
      ...(dto.entitlements ?? []),
    ];

    if (overridesToApply.length > 0) {
      for (const override of overridesToApply) {
        await this.repository.upsertEntitlement(existing.id, override, actorUserId);
      }
    }

    if (dto.addons && dto.addons.length > 0) {
      for (const addon of dto.addons) {
        await this.repository.assignAddon(existing.id, addon);
      }
    }

    const [entitlements, addons] = await Promise.all([
      this.repository.findEntitlements(existing.id),
      this.repository.findAddons(existing.id),
    ]);

    this.logger.log(
      `Updated entitlements and addons for tenant '${existing.slug}' (${entitlements.length} entitlements, ${addons.length} addons)`,
    );

    return {
      tenant: existing,
      entitlements,
      addons,
      message: TENANTS_MESSAGES.ENTITLEMENTS_UPDATED,
    };
  }

  /**
   * Retrieves current entitlements and addons for a tenant.
   */
  async getEntitlements(id: string) {
    const existing = await this.findById(id);
    const [entitlements, addons] = await Promise.all([
      this.repository.findEntitlements(existing.id),
      this.repository.findAddons(existing.id),
    ]);

    return {
      tenant: existing,
      entitlements,
      addons,
    };
  }
}
