import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditRepository } from './audit.repository.js';
import { PlatformUserRepository } from '../auth/repositories/platform-user.repository.js';
import {
  AUDIT_PAGINATION,
  AUDIT_SENSITIVE_FIELDS,
} from './constants/audit.constants.js';
import type {
  CreateAuditLogParams,
  EntitySnapshotLoader,
} from './interfaces/audit-entry.interface.js';
import type { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto.js';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly entityLoaders = new Map<string, EntitySnapshotLoader>();

  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly platformUserRepository: PlatformUserRepository,
  ) {
    this.registerEntityLoader('platform_users', (id: string) =>
      this.platformUserRepository.findById(id),
    );
    this.registerEntityLoader('users', (id: string) =>
      this.platformUserRepository.findById(id),
    );
  }

  /**
   * Register a domain entity snapshot loader (e.g. for 'tenants', 'plans', 'modules')
   */
  registerEntityLoader(entity: string, loader: EntitySnapshotLoader): void {
    this.entityLoaders.set(entity.toLowerCase().trim(), loader);
    this.logger.log(`Registered audit snapshot loader for entity: '${entity}'`);
  }

  /**
   * Fetches the current state of an entity before mutation
   */
  async resolveEntitySnapshot(
    entity: string,
    entityId: string,
  ): Promise<any | null> {
    const loader = this.entityLoaders.get(entity.toLowerCase().trim());
    if (!loader || !entityId) {
      return null;
    }

    try {
      const snapshot = await loader(entityId);
      return snapshot ? this.sanitizeData(snapshot) : null;
    } catch (err: any) {
      this.logger.warn(
        `Failed to resolve audit snapshot for ${entity}:${entityId}: ${err?.message}`,
      );
      return null;
    }
  }

  /**
   * Sanitizes object data, redacting/stripping sensitive fields recursively
   */
  sanitizeData(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(item));
    }

    if (typeof data === 'object' && !(data instanceof Date)) {
      const cleanObj: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        const isSensitive = AUDIT_SENSITIVE_FIELDS.some(
          (field) => field.toLowerCase() === key.toLowerCase(),
        );

        if (isSensitive) {
          cleanObj[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          cleanObj[key] = this.sanitizeData(value);
        } else {
          cleanObj[key] = value;
        }
      }
      return cleanObj;
    }

    return data;
  }

  /**
   * Persists an audit log entry in MongoDB in a resilient, non-blocking manner
   */
  async recordLog(params: CreateAuditLogParams) {
    try {
      const sanitizedBefore = params.before ? this.sanitizeData(params.before) : null;
      const sanitizedAfter = params.after ? this.sanitizeData(params.after) : null;

      const record = await this.auditRepository.create({
        tenantId: params.tenantId || null,
        actorId: params.actorId,
        actorEmail: params.actorEmail || null,
        actorRole: params.actorRole || null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        before: sanitizedBefore,
        after: sanitizedAfter,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata || null,
      });

      this.logger.log(
        `Audit log recorded: [${params.action}] on ${params.entity}:${params.entityId ?? 'new'} by actor ${params.actorEmail ?? params.actorId}`,
      );

      return record;
    } catch (err: any) {
      // Never crash the primary business transaction if audit logging fails
      this.logger.error(
        `Failed to write audit log for action '${params.action}': ${err?.message}`,
        err?.stack,
      );
      return null;
    }
  }

  /**
   * Query paginated audit logs with search, user, entity, and date range filters
   */
  async findAll(query: FindAuditLogsQueryDto) {
    const limit = query.limit ?? AUDIT_PAGINATION.DEFAULT_LIMIT;
    let offset = query.offset;

    if (offset === undefined) {
      const page = query.page && query.page > 0 ? query.page : 1;
      offset = (page - 1) * limit;
    }

    const filters = {
      entity: query.entity,
      userId: query.userId,
      actorId: query.actorId,
      startDate: query.startDate || query.from,
      endDate: query.endDate || query.to,
      tenantId: query.tenantId,
      action: query.action,
    };

    const pagination = {
      limit,
      offset,
    };

    const sort = {
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    };

    return this.auditRepository.findAll(filters, pagination, sort);
  }

  /**
   * Find audit log entry by ID or throw NotFoundException
   */
  async findById(id: string) {
    const log = await this.auditRepository.findById(id);
    if (!log) {
      throw new NotFoundException(`Audit log with ID '${id}' not found`);
    }
    return log;
  }
}
