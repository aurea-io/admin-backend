import { Injectable } from '@nestjs/common';
import type { ModuleCatalogKind, ModuleCatalogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface CatalogEntryFilters {
  kind?: ModuleCatalogKind;
  status?: ModuleCatalogStatus;
  sectionKey?: string;
}

@Injectable()
export class PlatformCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all non-archived entries matching optional filters.
   */
  findAll(filters: CatalogEntryFilters = {}) {
    const where: Prisma.ModuleCatalogEntryWhereInput = {
      isArchived: false,
      ...(filters.kind && { kind: filters.kind }),
      ...(filters.status && { status: filters.status }),
      ...(filters.sectionKey && { sectionKey: filters.sectionKey }),
    };
    return this.prisma.moduleCatalogEntry.findMany({
      where,
      orderBy: [{ sectionKey: 'asc' }, { pageKey: 'asc' }, { kind: 'asc' }, { key: 'asc' }],
    });
  }

  /**
   * Returns all non-archived entries ordered for tree construction.
   */
  findFlatTree() {
    return this.prisma.moduleCatalogEntry.findMany({
      where: { isArchived: false },
      orderBy: [{ sectionKey: 'asc' }, { pageKey: 'asc' }, { kind: 'asc' }, { key: 'asc' }],
    });
  }

  /**
   * Returns a single entry by its stable key, or null if not found.
   */
  findByKey(key: string) {
    return this.prisma.moduleCatalogEntry.findUnique({ where: { key } });
  }

  /**
   * Checks whether all provided keys exist in the catalog (non-archived).
   * Returns the set of missing keys.
   */
  async findMissingKeys(keys: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const found = await this.prisma.moduleCatalogEntry.findMany({
      where: { key: { in: keys }, isArchived: false },
      select: { key: true },
    });
    const foundSet = new Set(found.map((e) => e.key));
    return keys.filter((k) => !foundSet.has(k));
  }

  /**
   * Creates a new catalog entry.
   */
  create(data: Prisma.ModuleCatalogEntryCreateInput) {
    return this.prisma.moduleCatalogEntry.create({ data });
  }

  /**
   * Updates metadata fields of an existing entry and increments its version.
   */
  update(key: string, data: Prisma.ModuleCatalogEntryUpdateInput) {
    return this.prisma.moduleCatalogEntry.update({
      where: { key },
      data: { ...data, version: { increment: 1 } },
    });
  }

  /**
   * Updates the lifecycle status and optional maintenance fields.
   */
  updateStatus(key: string, data: Prisma.ModuleCatalogEntryUpdateInput) {
    return this.prisma.moduleCatalogEntry.update({ where: { key }, data });
  }

  /**
   * Soft-deletes an entry by marking it as archived. Never hard-deletes.
   */
  archive(key: string) {
    return this.prisma.moduleCatalogEntry.update({
      where: { key },
      data: { isArchived: true },
    });
  }
}
