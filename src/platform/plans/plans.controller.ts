import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../../auth/decorators/require-features.decorator.js';
import { AuditInterceptor } from '../../audit/interceptors/audit.interceptor.js';
import { Audited } from '../../audit/decorators/audited.decorator.js';
import { PlansService } from './plans.service.js';
import {
  CreatePlanDto,
  FindPlansQueryDto,
  UpdatePlanDto,
  UpdatePlanStatusDto,
} from './dto/index.js';

@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * GET /api/v1/platform/plans
   * Lists commercial plans with optional filters, pagination, and sorting.
   */
  @Get()
  @RequireFeatures('platform.plans.read')
  findAll(@Query() query: FindPlansQueryDto) {
    return this.plansService.findAll(query);
  }

  /**
   * GET /api/v1/platform/plans/:idOrKey
   * Retrieves a single commercial plan by its ID or unique key.
   */
  @Get(':idOrKey')
  @RequireFeatures('platform.plans.read')
  findOne(@Param('idOrKey') idOrKey: string) {
    return this.plansService.findByIdOrKey(idOrKey);
  }

  /**
   * POST /api/v1/platform/plans
   * Creates a new commercial plan.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireFeatures('platform.plans.write')
  @Audited({ entity: 'plans', action: 'plans.create' })
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  /**
   * PATCH /api/v1/platform/plans/:idOrKey
   * Updates an existing commercial plan.
   */
  @Patch(':idOrKey')
  @RequireFeatures('platform.plans.write')
  @Audited({ entity: 'plans', action: 'plans.update', entityIdParam: 'idOrKey' })
  update(@Param('idOrKey') idOrKey: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(idOrKey, dto);
  }

  /**
   * PATCH /api/v1/platform/plans/:idOrKey/status
   * Updates the lifecycle status of a plan.
   */
  @Patch(':idOrKey/status')
  @RequireFeatures('platform.plans.write')
  @Audited({ entity: 'plans', action: 'plans.status_change', entityIdParam: 'idOrKey' })
  updateStatus(
    @Param('idOrKey') idOrKey: string,
    @Body() dto: UpdatePlanStatusDto,
  ) {
    return this.plansService.updateStatus(idOrKey, dto);
  }

  /**
   * DELETE /api/v1/platform/plans/:idOrKey
   * Soft-archives a commercial plan.
   */
  @Delete(':idOrKey')
  @HttpCode(HttpStatus.OK)
  @RequireFeatures('platform.plans.write')
  @Audited({ entity: 'plans', action: 'plans.archive', entityIdParam: 'idOrKey' })
  archive(@Param('idOrKey') idOrKey: string) {
    return this.plansService.archive(idOrKey);
  }
}

