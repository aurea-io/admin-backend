import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

  listPlans() {
    return this.prisma.platformPlan.findMany({ orderBy: { createdAt: 'desc' } });
  }

  listFeatures() {
    return this.prisma.platformFeature.findMany({ where: { isActive: true }, orderBy: { key: 'asc' } });
  }
}
