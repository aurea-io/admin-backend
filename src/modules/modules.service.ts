import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma, type ModuleCatalogEntry, type ModuleCatalogStatus } from '@prisma/client';
import { ModulesRepository, type ModuleFilters } from './modules.repository.js';
import type { CreateModuleDto } from './dto/create-module.dto.js';
import type { UpdateModuleDto } from './dto/update-module.dto.js';
import type { UpdateModuleStatusDto } from './dto/update-module-status.dto.js';

// Valid lifecycle transitions:
// draft → active
// active → toBeDeprecated
// toBeDeprecated → deprecated
// Any status → same status (idempotent)
const VALID_TRANSITIONS: Record<string, ModuleCatalogStatus[]> = {
  draft: ['active'],
  active: ['toBeDeprecated'],
  toBeDeprecated: ['deprecated'],
  deprecated: [],
};

export interface ModuleTree {
  [sectionKey: string]: {
    [pageKey: string]: ModuleCatalogEntry[];
  };
}

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(private readonly repo: ModulesRepository) {}

  /**
   * Lists all non-archived catalog entries with optional filters.
   */
  findAll(filters: ModuleFilters = {}) {
    return this.repo.findAll(filters);
  }

  /**
   * Returns the hierarchical tree: { sectionKey → { pageKey → entries[] } }
   */
  async getTree(): Promise<ModuleTree> {
    const entries = await this.repo.findFlatTree();
    const tree: ModuleTree = {};

    for (const entry of entries) {
      const section = entry.sectionKey;
      const page = entry.pageKey ?? '_module';

      if (!tree[section]) tree[section] = {};
      if (!tree[section][page]) tree[section][page] = [];
      tree[section][page].push(entry);
    }

    return tree;
  }

  /**
   * Returns a single catalog entry by its stable key.
   */
  async findByKey(key: string): Promise<ModuleCatalogEntry> {
    const entry = await this.repo.findByKey(key);
    if (!entry || entry.isArchived) {
      throw new NotFoundException(`Module with key '${key}' not found.`);
    }
    return entry;
  }

  /**
   * Creates a new module catalog entry.
   * Validates: key uniqueness, dependency existence.
   */
  async create(dto: CreateModuleDto): Promise<ModuleCatalogEntry> {
    // 1. Ensure key is not already in use
    const existing = await this.repo.findByKey(dto.key);
    if (existing) {
      throw new ConflictException(`A module with key '${dto.key}' already exists.`);
    }

    // 2. Validate dependencies exist
    await this.assertDependenciesExist(dto.dependencies ?? []);

    const availability =
      dto.availablePlans !== undefined || dto.requiresSubscription !== undefined
        ? {
            plans: dto.availablePlans ?? [],
            requiresSubscription: dto.requiresSubscription ?? false,
          }
        : undefined;

    try {
      const entry = await this.repo.create({
        key: dto.key,
        kind: dto.kind,
        moduleKey: dto.moduleKey,
        sectionKey: dto.sectionKey,
        pageKey: dto.pageKey ?? null,
        scope: dto.scope ?? 'platform',
        name: dto.name,
        description: dto.description ?? null,
        dependencies: dto.dependencies ?? [],
        requiredPermissions: dto.requiredPermissions ?? [],
        availability,
        ownerTeam: dto.ownerTeam ?? null,
        manifest: dto.manifest ?? null,
      });

      this.logger.log(`Created module: ${entry.key} (kind: ${entry.kind})`);
      return entry;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`A module with key '${dto.key}' already exists.`);
      }
      throw error;
    }
  }

  /**
   * Updates metadata of an existing entry and increments its version.
   * Validates dependency existence when dependencies are changed.
   */
  async update(key: string, dto: UpdateModuleDto): Promise<ModuleCatalogEntry> {
    const entry = await this.findByKey(key);

    if (dto.dependencies !== undefined) {
      await this.assertDependenciesExist(dto.dependencies);
    }

    let availability = undefined;
    if (dto.availablePlans !== undefined || dto.requiresSubscription !== undefined) {
      const existingAvailability = entry.availability as {
        plans?: string[];
        requiresSubscription?: boolean;
      } | null;
      const plans =
        dto.availablePlans !== undefined
          ? dto.availablePlans
          : (existingAvailability?.plans ?? []);
      const requiresSubscription =
        dto.requiresSubscription !== undefined
          ? dto.requiresSubscription
          : (existingAvailability?.requiresSubscription ?? false);
      availability = { plans, requiresSubscription };
    }

    const updated = await this.repo.update(key, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.dependencies !== undefined && { dependencies: dto.dependencies }),
      ...(dto.requiredPermissions !== undefined && { requiredPermissions: dto.requiredPermissions }),
      ...(dto.ownerTeam !== undefined && { ownerTeam: dto.ownerTeam }),
      ...(dto.manifest !== undefined && { manifest: dto.manifest }),
      ...(availability !== undefined && { availability }),
    });

    this.logger.log(`Updated module: ${key} (version → ${updated.version})`);
    return updated;
  }

  /**
   * Updates lifecycle status and/or maintenance window.
   * Validates that the requested status transition is allowed.
   */
  async updateStatus(key: string, dto: UpdateModuleStatusDto): Promise<ModuleCatalogEntry> {
    const entry = await this.findByKey(key);

    // Validate lifecycle transition if status is being updated (idempotent: same → same is always valid)
    if (dto.status !== undefined && dto.status !== entry.status) {
      const allowed = VALID_TRANSITIONS[entry.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition: '${entry.status}' → '${dto.status}'. ` +
          `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}.`,
        );
      }
    }

    // Resolve effective maintenance window dates to ensure valid range
    const effectiveStartsAt =
      dto.maintenanceStartsAt !== undefined
        ? (dto.maintenanceStartsAt ? new Date(dto.maintenanceStartsAt) : null)
        : entry.maintenanceStartsAt;
    const effectiveEndsAt =
      dto.maintenanceEndsAt !== undefined
        ? (dto.maintenanceEndsAt ? new Date(dto.maintenanceEndsAt) : null)
        : entry.maintenanceEndsAt;

    if (effectiveStartsAt && effectiveEndsAt && effectiveStartsAt > effectiveEndsAt) {
      throw new BadRequestException(
        'Invalid maintenance window: maintenanceStartsAt cannot be later than maintenanceEndsAt.',
      );
    }

    const updated = await this.repo.updateStatus(key, {
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.maintenanceEnabled !== undefined && { maintenanceEnabled: dto.maintenanceEnabled }),
      ...(dto.maintenanceMessage !== undefined && { maintenanceMessage: dto.maintenanceMessage }),
      ...(dto.maintenanceStartsAt !== undefined && {
        maintenanceStartsAt: dto.maintenanceStartsAt ? new Date(dto.maintenanceStartsAt) : null,
      }),
      ...(dto.maintenanceEndsAt !== undefined && {
        maintenanceEndsAt: dto.maintenanceEndsAt ? new Date(dto.maintenanceEndsAt) : null,
      }),
    });

    this.logger.log(
      `Status/maintenance updated for '${key}': ` +
      (dto.status ? `${entry.status} → ${dto.status}` : 'maintenance-only') +
      (dto.maintenanceEnabled !== undefined ? ` | maintenance=${dto.maintenanceEnabled}` : ''),
    );
    return updated;
  }

  /**
   * Soft-archives a catalog entry. Historical data is preserved.
   */
  async archive(key: string): Promise<{ message: string }> {
    await this.findByKey(key);
    await this.repo.archive(key);
    this.logger.log(`Archived module: ${key}`);
    return { message: `Module '${key}' has been archived.` };
  }

  // ── Private Helpers ──────────────────────────────────────────────────────────

  private async assertDependenciesExist(dependencies: string[]): Promise<void> {
    if (dependencies.length === 0) return;
    const missing = await this.repo.findMissingKeys(dependencies);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown dependencies: ${missing.map((k) => `'${k}'`).join(', ')}. ` +
        'All dependency keys must exist in the catalog before referencing them.',
      );
    }
  }
}
