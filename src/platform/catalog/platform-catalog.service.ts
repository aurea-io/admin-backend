import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { ModuleCatalogEntry, ModuleCatalogStatus } from '@prisma/client';
import { PlatformCatalogRepository } from './platform-catalog.repository.js';
import type { CreateCatalogEntryDto } from './dto/create-catalog-entry.dto.js';
import type { UpdateCatalogEntryDto } from './dto/update-catalog-entry.dto.js';
import type { UpdateCatalogStatusDto } from './dto/update-catalog-status.dto.js';

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

export interface CatalogTree {
  [sectionKey: string]: {
    [pageKey: string]: ModuleCatalogEntry[];
  };
}

@Injectable()
export class PlatformCatalogService {
  private readonly logger = new Logger(PlatformCatalogService.name);

  constructor(private readonly repo: PlatformCatalogRepository) {}

  /**
   * Lists all non-archived catalog entries with optional filters.
   */
  findAll(filters: { kind?: any; status?: any; sectionKey?: string } = {}) {
    return this.repo.findAll(filters);
  }

  /**
   * Returns the hierarchical tree: { sectionKey → { pageKey → entries[] } }
   */
  async getTree(): Promise<CatalogTree> {
    const entries = await this.repo.findFlatTree();
    const tree: CatalogTree = {};

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
      throw new NotFoundException(`Module catalog entry with key '${key}' not found.`);
    }
    return entry;
  }

  /**
   * Creates a new catalog entry.
   * Validates: key uniqueness, dependency existence.
   */
  async create(dto: CreateCatalogEntryDto): Promise<ModuleCatalogEntry> {
    // 1. Ensure key is not already in use
    const existing = await this.repo.findByKey(dto.key);
    if (existing) {
      throw new ConflictException(`A catalog entry with key '${dto.key}' already exists.`);
    }

    // 2. Validate dependencies exist
    await this.assertDependenciesExist(dto.dependencies ?? []);

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
      availability: dto.availablePlans !== undefined
        ? { plans: dto.availablePlans, requiresSubscription: dto.requiresSubscription ?? false }
        : undefined,
      ownerTeam: dto.ownerTeam ?? null,
      manifest: dto.manifest ?? null,
    });

    this.logger.log(`Created catalog entry: ${entry.key} (kind: ${entry.kind})`);
    return entry;
  }

  /**
   * Updates metadata of an existing entry and increments its version.
   * Validates dependency existence when dependencies are changed.
   */
  async update(key: string, dto: UpdateCatalogEntryDto): Promise<ModuleCatalogEntry> {
    await this.findByKey(key);

    if (dto.dependencies !== undefined) {
      await this.assertDependenciesExist(dto.dependencies);
    }

    const updated = await this.repo.update(key, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.scope !== undefined && { scope: dto.scope }),
      ...(dto.dependencies !== undefined && { dependencies: dto.dependencies }),
      ...(dto.requiredPermissions !== undefined && { requiredPermissions: dto.requiredPermissions }),
      ...(dto.ownerTeam !== undefined && { ownerTeam: dto.ownerTeam }),
      ...(dto.manifest !== undefined && { manifest: dto.manifest }),
      ...(dto.availablePlans !== undefined && {
        availability: {
          plans: dto.availablePlans,
          requiresSubscription: dto.requiresSubscription ?? false,
        },
      }),
    });

    this.logger.log(`Updated catalog entry: ${key} (version → ${updated.version})`);
    return updated;
  }

  /**
   * Updates lifecycle status and/or maintenance window.
   * Validates that the requested status transition is allowed.
   */
  async updateStatus(key: string, dto: UpdateCatalogStatusDto): Promise<ModuleCatalogEntry> {
    const entry = await this.findByKey(key);

    // Validate lifecycle transition (idempotent: same → same is always valid)
    if (dto.status !== entry.status) {
      const allowed = VALID_TRANSITIONS[entry.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid status transition: '${entry.status}' → '${dto.status}'. ` +
          `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}.`,
        );
      }
    }

    const updated = await this.repo.updateStatus(key, {
      status: dto.status,
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
      `Status updated for '${key}': ${entry.status} → ${dto.status}` +
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
    this.logger.log(`Archived catalog entry: ${key}`);
    return { message: `Catalog entry '${key}' has been archived.` };
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
