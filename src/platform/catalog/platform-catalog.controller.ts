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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { ModuleCatalogKind, ModuleCatalogStatus } from '@prisma/client';
import { PlatformJwtAuthGuard } from '../../auth/guards/platform-jwt-auth.guard.js';
import { PlatformPermissionsGuard } from '../../auth/guards/platform-permissions.guard.js';
import { RequireFeatures } from '../../auth/decorators/require-features.decorator.js';
import { PlatformCatalogService } from './platform-catalog.service.js';
import {
  CreateCatalogEntryDto,
  UpdateCatalogEntryDto,
  UpdateCatalogStatusDto,
} from './dto/index.js';

@Controller('platform/catalog/modules')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
export class PlatformCatalogController {
  constructor(private readonly catalogService: PlatformCatalogService) {}

  /**
   * GET /platform/catalog/modules
   * Lists all non-archived catalog entries. Filterable by kind, status and sectionKey.
   * Accessible to any authenticated platform user.
   */
  @Get()
  findAll(
    @Query('kind') kind?: ModuleCatalogKind,
    @Query('status') status?: ModuleCatalogStatus,
    @Query('sectionKey') sectionKey?: string,
  ) {
    return this.catalogService.findAll({ kind, status, sectionKey });
  }

  /**
   * GET /platform/catalog/modules/tree
   * Returns the hierarchical tree: { sectionKey → { pageKey → entries[] } }
   * Accessible to any authenticated platform user.
   */
  @Get('tree')
  getTree() {
    return this.catalogService.getTree();
  }

  /**
   * GET /platform/catalog/modules/:key
   * Returns a single catalog entry by its stable key.
   * Accessible to any authenticated platform user.
   */
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.catalogService.findByKey(key);
  }

  /**
   * POST /platform/catalog/modules
   * Creates a new catalog entry. Requires platform_owner or platform_operator with
   * the 'platform.catalog.modules.write' feature.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireFeatures('platform.catalog.modules.write')
  create(@Body() dto: CreateCatalogEntryDto) {
    return this.catalogService.create(dto);
  }

  /**
   * PATCH /platform/catalog/modules/:key
   * Updates metadata of an existing catalog entry.
   * Requires platform_owner or platform_operator with 'platform.catalog.modules.write'.
   */
  @Patch(':key')
  @RequireFeatures('platform.catalog.modules.write')
  update(@Param('key') key: string, @Body() dto: UpdateCatalogEntryDto) {
    return this.catalogService.update(key, dto);
  }

  /**
   * PATCH /platform/catalog/modules/:key/status
   * Updates the lifecycle status and/or maintenance window.
   * Validates the transition is allowed. Maintenance is orthogonal to status.
   * Requires platform_owner or platform_operator with 'platform.catalog.modules.status'.
   */
  @Patch(':key/status')
  @RequireFeatures('platform.catalog.modules.status')
  updateStatus(@Param('key') key: string, @Body() dto: UpdateCatalogStatusDto) {
    return this.catalogService.updateStatus(key, dto);
  }

  /**
   * DELETE /platform/catalog/modules/:key
   * Soft-archives a catalog entry (marks isArchived=true). Data is preserved.
   * Requires platform_owner or platform_operator with 'platform.catalog.modules.write'.
   */
  @Delete(':key')
  @HttpCode(HttpStatus.OK)
  @RequireFeatures('platform.catalog.modules.write')
  archive(@Param('key') key: string) {
    return this.catalogService.archive(key);
  }
}
