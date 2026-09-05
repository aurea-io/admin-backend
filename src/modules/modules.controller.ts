import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { ModuleCatalogKind, ModuleCatalogStatus } from '@prisma/client';
import { PlatformJwtAuthGuard } from '../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../auth/decorators/require-features.decorator.js';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor.js';
import { Audited } from '../audit/decorators/audited.decorator.js';
import { ModulesService } from './modules.service.js';
import {
  CreateModuleDto,
  UpdateModuleDto,
  UpdateModuleStatusDto,
  FindModulesQueryDto,
} from './dto/index.js';

@Controller('modules')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  /**
   * GET /api/v1/modules
   * Lists all non-archived catalog entries. Filterable by kind, status and sectionKey.
   */
  @Get()
  findAll(@Query() query: FindModulesQueryDto) {
    return this.modulesService.findAll(query);
  }

  /**
   * GET /api/v1/modules/tree
   * Returns the hierarchical tree: { sectionKey → { pageKey → entries[] } }
   */
  @Get('tree')
  getTree() {
    return this.modulesService.getTree();
  }

  /**
   * GET /api/v1/modules/:key
   * Returns a single catalog entry by its stable key.
   */
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.modulesService.findByKey(key);
  }

  /**
   * POST /api/v1/modules
   * Creates a new module entry.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireFeatures('modules.write')
  @Audited({ entity: 'modules', action: 'modules.create' })
  create(@Body() dto: CreateModuleDto) {
    return this.modulesService.create(dto);
  }

  /**
   * PATCH /api/v1/modules/:key
   * Updates metadata of an existing module entry.
   */
  @Patch(':key')
  @RequireFeatures('modules.write')
  @Audited({ entity: 'modules', action: 'modules.update', entityIdParam: 'key' })
  update(@Param('key') key: string, @Body() dto: UpdateModuleDto) {
    return this.modulesService.update(key, dto);
  }

  /**
   * PATCH /api/v1/modules/:key/status
   * Updates lifecycle status and/or maintenance window.
   */
  @Patch(':key/status')
  @RequireFeatures('modules.status')
  @Audited({ entity: 'modules', action: 'modules.status_change', entityIdParam: 'key' })
  updateStatus(@Param('key') key: string, @Body() dto: UpdateModuleStatusDto) {
    return this.modulesService.updateStatus(key, dto);
  }

  /**
   * DELETE /api/v1/modules/:key
   * Soft-archives a module entry (marks isArchived=true).
   */
  @Delete(':key')
  @HttpCode(HttpStatus.OK)
  @RequireFeatures('modules.write')
  @Audited({ entity: 'modules', action: 'modules.archive', entityIdParam: 'key' })
  archive(@Param('key') key: string) {
    return this.modulesService.archive(key);
  }
}

