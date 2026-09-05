import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AUDIT_PAGINATION } from './constants/audit.constants.js';
import type {
  AuditLogFilters,
  AuditLogPagination,
  AuditLogSort,
} from './interfaces/audit-entry.interface.js';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist an immutable audit log entry in MongoDB
   */
  async create(data: Prisma.PlatformAuditLogCreateInput) {
    return this.prisma.platformAuditLog.create({
      data,
    });
  }

  /**
   * Find a single audit log entry by its MongoDB ObjectId
   */
  async findById(id: string) {
    return this.prisma.platformAuditLog.findUnique({
      where: { id },
    });
  }

  /**
   * Query audit logs with pagination, sorting, and multi-criteria filtering
   */
  async findAll(
    filters: AuditLogFilters = {},
    pagination: AuditLogPagination = {},
    sort: AuditLogSort = {},
  ) {
    const andClauses: any[] = [];

    // Filter by Entity
    if (filters.entity) {
      andClauses.push({
        entity: { equals: filters.entity.trim(), mode: 'insensitive' },
      });
    }

    // Filter by Actor (User ID or Email)
    const targetUserId = filters.userId || filters.actorId;
    if (targetUserId) {
      const cleanUser = targetUserId.trim();
      andClauses.push({
        OR: [
          { actorId: cleanUser },
          { actorEmail: { equals: cleanUser, mode: 'insensitive' } },
        ],
      });
    }

    // Filter by Tenant ID
    if (filters.tenantId) {
      andClauses.push({
        tenantId: filters.tenantId.trim(),
      });
    }

    // Filter by Action
    if (filters.action) {
      andClauses.push({
        action: { equals: filters.action.trim(), mode: 'insensitive' },
      });
    }

    // Filter by Date Range (startDate / endDate)
    if (filters.startDate || filters.endDate) {
      const createdAtClause: { gte?: Date; lte?: Date } = {};
      if (filters.startDate) {
        createdAtClause.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        createdAtClause.lte = new Date(filters.endDate);
      }
      andClauses.push({
        createdAt: createdAtClause,
      });
    }

    const where: Prisma.PlatformAuditLogWhereInput =
      andClauses.length > 0 ? { AND: andClauses } : {};

    const limit = pagination.limit ?? AUDIT_PAGINATION.DEFAULT_LIMIT;
    const offset = pagination.offset ?? AUDIT_PAGINATION.DEFAULT_OFFSET;
    const sortBy = sort.sortBy ?? 'createdAt';
    const sortOrder = sort.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    const page = Math.floor(offset / limit) + 1;

    return {
      items,
      total,
      limit,
      offset,
      page,
      data: items,
    };
  }
}
