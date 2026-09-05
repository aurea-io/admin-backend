import type { Request } from 'express';

export interface AuditedOptions {
  /**
   * Entity name being mutated (e.g. 'tenants', 'plans', 'modules', 'platform_users')
   */
  entity: string;

  /**
   * Optional action name override (e.g. 'tenants.create', 'tenants.status_change').
   * If omitted, defaults to `${entity}.${methodName}` or `${entity}.${httpVerb}`.
   */
  action?: string;

  /**
   * Name of parameter in req.params containing entity ID/key. Default: 'id' or 'key'.
   */
  entityIdParam?: string;

  /**
   * Custom function to extract entity identifier from request.
   */
  getEntityId?: (req: Request) => string | undefined;

  /**
   * Custom function to extract tenantId from request and/or handler response.
   */
  getTenantId?: (req: Request, result?: any) => string | undefined;
}

export interface CreateAuditLogParams {
  tenantId?: string | null;
  actorId: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: any;
  after?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: any;
}

export interface AuditLogFilters {
  entity?: string;
  userId?: string;
  actorId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  tenantId?: string;
  action?: string;
}

export interface AuditLogPagination {
  limit?: number;
  offset?: number;
}

export interface AuditLogSort {
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export type EntitySnapshotLoader = (entityId: string) => Promise<any>;
