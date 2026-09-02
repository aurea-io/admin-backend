import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreatePlanDto, CreateTenantDto, UpdatePlanDto, UpdateTenantDto } from './dto/platform.dto.js';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  listTenants() {
    return this.prisma.platformTenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.platformTenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  createTenant(dto: CreateTenantDto) {
    return this.prisma.platformTenant.create({ data: { ...dto, slug: dto.slug.toLowerCase().trim() } });
  }

  async updateTenant(id: string, dto: UpdateTenantDto) {
    await this.getTenant(id);
    return this.prisma.platformTenant.update({ where: { id }, data: dto });
  }

  listPlans() {
    return this.prisma.platformPlan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.platformPlan.create({ data: { ...dto, includedFeatures: dto.includedFeatures ?? [] } });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.platformPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.prisma.platformPlan.update({ where: { id }, data: dto });
  }

  listFeatures() {
    return this.prisma.platformFeature.findMany({ where: { isActive: true }, orderBy: { key: 'asc' } });
  }
}
