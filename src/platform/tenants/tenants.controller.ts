import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { PlatformJwtAuthGuard } from '../../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../../auth/decorators/require-features.decorator.js';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor.js';
import { Audited } from '../../audit/decorators/audited.decorator.js';
import { TenantsService } from './tenants.service.js';
import {
  CreateTenantDto,
  FindTenantsQueryDto,
  UpdateTenantDto,
  UpdateTenantStatusDto,
  UpdateTenantEntitlementsDto,
} from './dto/index.js';

@Controller(['admin/tenants', 'platform/tenants'])
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /api/v1/admin/tenants (and /api/v1/platform/tenants)
   * Paginated listing of client merchants with search, status, and plan filters.
   */
  @Get()
  @RequireFeatures('platform.tenants.read')
  async findAll(@Query() query: FindTenantsQueryDto, @Req() req: Request) {
    const result = await this.tenantsService.findAll(query);
    if (req.baseUrl?.includes('platform') && Object.keys(query).length === 0) {
      return result.items;
    }
    return result;
  }

  /**
   * GET /api/v1/admin/tenants/:id
   * Retrieves a single merchant tenant by its ID or unique slug.
   */
  @Get(':id')
  @RequireFeatures('platform.tenants.read')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findByIdOrSlug(id);
  }

  /**
   * POST /api/v1/admin/tenants
   * Creates a new client merchant tenant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireFeatures('platform.tenants.write')
  @Audited({ entity: 'tenants', action: 'tenants.create' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  /**
   * PATCH /api/v1/admin/tenants/:id
   * Updates metadata or properties of an existing tenant.
   */
  @Patch(':id')
  @RequireFeatures('platform.tenants.write')
  @Audited({ entity: 'tenants', action: 'tenants.update' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  /**
   * PATCH /api/v1/admin/tenants/:id/status
   * Suspends or reactivates a merchant account.
   */
  @Patch(':id/status')
  @RequireFeatures('platform.tenants.write')
  @Audited({ entity: 'tenants', action: 'tenants.status_change' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.tenantsService.updateStatus(id, dto);
  }

  /**
   * PUT /api/v1/admin/tenants/:id/entitlements
   * Applies capability overrides (allow / deny) and assigns addons.
   */
  @Put(':id/entitlements')
  @RequireFeatures('platform.tenants.write')
  @Audited({ entity: 'tenants', action: 'tenants.entitlements_update' })
  updateEntitlements(
    @Param('id') id: string,
    @Body() dto: UpdateTenantEntitlementsDto,
    @Req() req: Request,
  ) {
    const actorUserId = (req as any).user?.sub;
    return this.tenantsService.updateEntitlements(id, dto, actorUserId);
  }

  /**
   * GET /api/v1/admin/tenants/:id/entitlements
   * Retrieves current capability overrides and addons for a tenant.
   */
  @Get(':id/entitlements')
  @RequireFeatures('platform.tenants.read')
  getEntitlements(@Param('id') id: string) {
    return this.tenantsService.getEntitlements(id);
  }
}
