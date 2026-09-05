import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../auth/decorators/require-features.decorator.js';
import { AuditService } from './audit.service.js';
import { FindAuditLogsQueryDto } from './dto/find-audit-logs-query.dto.js';
import { AUDIT_PERMISSIONS } from './constants/audit.constants.js';

@Controller(['audit', 'admin/audit'])
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/v1/audit (and /api/v1/admin/audit)
   * Paginated listing of audit logs with filters by entity, user, date range, action, and tenant.
   */
  @Get()
  @RequireFeatures(AUDIT_PERMISSIONS.READ)
  findAll(@Query() query: FindAuditLogsQueryDto) {
    return this.auditService.findAll(query);
  }

  /**
   * GET /api/v1/audit/:id
   * Retrieves an immutable audit log entry by its unique identifier.
   */
  @Get(':id')
  @RequireFeatures(AUDIT_PERMISSIONS.READ)
  findOne(@Param('id') id: string) {
    return this.auditService.findById(id);
  }
}
