import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import type { Request } from 'express';
import { AuditService } from '../audit.service.js';
import { AUDITED_METADATA_KEY } from '../constants/audit.constants.js';
import type { AuditedOptions } from '../interfaces/audit-entry.interface.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const auditOptions = this.reflector.getAllAndOverride<AuditedOptions>(
      AUDITED_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If route or controller is not decorated with @Audited, pass through
    if (!auditOptions) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method?.toUpperCase();

    // Only audit mutating operations
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const entity = auditOptions.entity;
    const action =
      auditOptions.action ||
      `${entity}.${context.getHandler().name || method.toLowerCase()}`;

    // Extract actor details from verified JWT request state
    const user = (req as any).user;
    const actorId = user?.sub || 'system';
    const actorEmail = user?.email || null;
    const actorRole = user?.role || null;

    // Extract client IP address and user-agent
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || null;

    // Extract entity identifier if present
    const getParamString = (val: unknown): string | null => {
      if (typeof val === 'string') return val;
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') return val[0];
      return null;
    };

    const paramKey = auditOptions.entityIdParam || (req.params?.id ? 'id' : 'key');
    const entityId: string | null =
      auditOptions.getEntityId?.(req) ??
      getParamString(req.params?.[paramKey]) ??
      getParamString(req.params?.id) ??
      getParamString(req.params?.key) ??
      getParamString(req.params?.slug) ??
      getParamString(req.body?.id) ??
      getParamString(req.body?.key) ??
      null;

    // Resolve 'before' snapshot asynchronously before executing handler
    const resolveBefore$ = from(
      method !== 'POST' && entityId
        ? this.auditService.resolveEntitySnapshot(entity, entityId)
        : Promise.resolve(null),
    );

    return resolveBefore$.pipe(
      switchMap((beforeSnapshot) => {
        return next.handle().pipe(
          tap({
            next: (result) => {
              // Asynchronously record audit log on mutation success
              const rawFinalEntityId =
                entityId ?? result?.id ?? result?.key ?? result?.slug ?? null;
              const finalEntityId = getParamString(rawFinalEntityId) ?? (rawFinalEntityId ? String(rawFinalEntityId) : null);

              // Determine tenantId scope
              let tenantId: string | null = null;
              if (auditOptions.getTenantId) {
                tenantId = auditOptions.getTenantId(req, result) || null;
              } else if (entity === 'tenants') {
                tenantId = finalEntityId;
              } else {
                const rawTenantId =
                  result?.tenantId ??
                  req.params?.tenantId ??
                  req.body?.tenantId ??
                  beforeSnapshot?.tenantId ??
                  null;
                tenantId = getParamString(rawTenantId) ?? (rawTenantId ? String(rawTenantId) : null);
              }

              const afterSnapshot =
                method === 'DELETE'
                  ? (result ?? { deleted: true })
                  : (result ?? req.body);

              // Non-blocking invocation
              void this.auditService.recordLog({
                tenantId,
                actorId,
                actorEmail,
                actorRole,
                action,
                entity,
                entityId: finalEntityId,
                before: beforeSnapshot,
                after: afterSnapshot,
                ipAddress,
                userAgent,
                metadata: {
                  path: req.originalUrl || req.url,
                  method: req.method,
                },
              });
            },
          }),
        );
      }),
    );
  }
}
