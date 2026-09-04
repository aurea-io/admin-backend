import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  listFeatures() {
    return this.prisma.platformFeature.findMany({ where: { isActive: true }, orderBy: { key: 'asc' } });
  }
}


