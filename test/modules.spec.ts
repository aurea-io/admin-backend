import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ModuleCatalogKind, ModuleCatalogStatus } from '@prisma/client';
import { ModulesService } from '../src/modules/modules.service.js';
import { ModulesController } from '../src/modules/modules.controller.js';
import { validateCatalogContract } from '../src/modules/contracts/catalog-contract.validator.js';
import { defineCatalogManifest, buildCatalogContract } from '../src/modules/manifests/registry.js';
import type { ModulesRepository } from '../src/modules/modules.repository.js';
import type { CreateModuleDto, UpdateModuleDto, UpdateModuleStatusDto } from '../src/modules/dto/index.js';

describe('Modules First-Class Resource', () => {
  let service: ModulesService;
  let controller: ModulesController;
  let mockRepo: Record<keyof ModulesRepository, any>;

  const sampleEntry = {
    id: '65f1a2b3c4d5e6f7a8b9c0d1',
    key: 'services.bookings.create',
    kind: ModuleCatalogKind.feature,
    moduleKey: 'bookings',
    sectionKey: 'services',
    pageKey: 'bookings',
    scope: 'tenant',
    name: 'Crear reservas',
    description: 'Permite agendar una nueva reserva',
    status: ModuleCatalogStatus.draft,
    isArchived: false,
    maintenanceEnabled: false,
    maintenanceMessage: null,
    maintenanceStartsAt: null,
    maintenanceEndsAt: null,
    maintenanceChangedBy: null,
    version: 1,
    dependencies: ['services.bookings'],
    requiredPermissions: ['bookings:write'],
    availability: { plans: ['pro'], requiresSubscription: true },
    compatibility: null,
    metadata: null,
    ownerTeam: 'bookings-core',
    manifest: 'packages/bookings/features.ts',
    autoDiscovered: false,
    catalogVersion: null,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
  };

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findFlatTree: vi.fn(),
      findByKey: vi.fn(),
      findMissingKeys: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      archive: vi.fn(),
    } as any;

    service = new ModulesService(mockRepo as unknown as ModulesRepository);
    controller = new ModulesController(service);
  });

  describe('ModulesService', () => {
    describe('findAll', () => {
      it('should delegate to repository.findAll with filters', async () => {
        mockRepo.findAll.mockResolvedValue([sampleEntry]);
        const filters = { kind: ModuleCatalogKind.feature, status: ModuleCatalogStatus.draft };

        const result = await service.findAll(filters);

        expect(mockRepo.findAll).toHaveBeenCalledWith(filters);
        expect(result).toEqual([sampleEntry]);
      });
    });

    describe('getTree', () => {
      it('should assemble entries into a Section -> Page -> Entries tree structure', async () => {
        const entryModule = {
          ...sampleEntry,
          key: 'services.bookings',
          kind: ModuleCatalogKind.module,
          pageKey: null,
        };
        const entryFeature = {
          ...sampleEntry,
          key: 'services.bookings.create',
          kind: ModuleCatalogKind.feature,
          pageKey: 'bookings',
        };

        mockRepo.findFlatTree.mockResolvedValue([entryModule, entryFeature]);

        const tree = await service.getTree();

        expect(tree).toHaveProperty('services');
        expect(tree.services).toHaveProperty('_module');
        expect(tree.services._module).toContainEqual(entryModule);
        expect(tree.services).toHaveProperty('bookings');
        expect(tree.services.bookings).toContainEqual(entryFeature);
      });
    });

    describe('findByKey', () => {
      it('should return entry if found and not archived', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);

        const result = await service.findByKey('services.bookings.create');
        expect(result).toEqual(sampleEntry);
      });

      it('should throw NotFoundException if entry does not exist', async () => {
        mockRepo.findByKey.mockResolvedValue(null);

        await expect(service.findByKey('unknown.key')).rejects.toThrow(NotFoundException);
      });

      it('should throw NotFoundException if entry is archived', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, isArchived: true });

        await expect(service.findByKey('services.bookings.create')).rejects.toThrow(NotFoundException);
      });
    });

    describe('create', () => {
      const dto: CreateModuleDto = {
        key: 'services.bookings.create',
        kind: ModuleCatalogKind.feature,
        moduleKey: 'bookings',
        sectionKey: 'services',
        pageKey: 'bookings',
        name: 'Crear reservas',
        dependencies: ['services.bookings'],
      };

      it('should create an entry after validating uniqueness and dependencies', async () => {
        mockRepo.findByKey.mockResolvedValue(null);
        mockRepo.findMissingKeys.mockResolvedValue([]);
        mockRepo.create.mockResolvedValue(sampleEntry);

        const result = await service.create(dto);

        expect(mockRepo.findByKey).toHaveBeenCalledWith(dto.key);
        expect(mockRepo.findMissingKeys).toHaveBeenCalledWith(['services.bookings']);
        expect(mockRepo.create).toHaveBeenCalled();
        expect(result).toEqual(sampleEntry);
      });

      it('should throw ConflictException if key already exists', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);

        await expect(service.create(dto)).rejects.toThrow(ConflictException);
        expect(mockRepo.create).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException if dependencies do not exist', async () => {
        mockRepo.findByKey.mockResolvedValue(null);
        mockRepo.findMissingKeys.mockResolvedValue(['services.bookings']);

        await expect(service.create(dto)).rejects.toThrow(BadRequestException);
        expect(mockRepo.create).not.toHaveBeenCalled();
      });
    });

    describe('update', () => {
      const updateDto: UpdateModuleDto = {
        name: 'Nuevo Nombre',
        dependencies: ['services.bookings.v2'],
      };

      it('should update metadata and validate modified dependencies', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);
        mockRepo.findMissingKeys.mockResolvedValue([]);
        mockRepo.update.mockResolvedValue({ ...sampleEntry, name: 'Nuevo Nombre', version: 2 });

        const result = await service.update('services.bookings.create', updateDto);

        expect(mockRepo.findMissingKeys).toHaveBeenCalledWith(['services.bookings.v2']);
        expect(mockRepo.update).toHaveBeenCalledWith('services.bookings.create', expect.objectContaining({
          name: 'Nuevo Nombre',
          dependencies: ['services.bookings.v2'],
        }));
        expect(result.version).toBe(2);
      });

      it('should throw BadRequestException if modified dependencies do not exist', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);
        mockRepo.findMissingKeys.mockResolvedValue(['services.bookings.v2']);

        await expect(service.update('services.bookings.create', updateDto)).rejects.toThrow(BadRequestException);
        expect(mockRepo.update).not.toHaveBeenCalled();
      });
    });

    describe('updateStatus', () => {
      it('should allow valid transition draft -> active', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.draft });
        mockRepo.updateStatus.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.active });

        const statusDto: UpdateModuleStatusDto = { status: ModuleCatalogStatus.active };
        const result = await service.updateStatus('services.bookings.create', statusDto);

        expect(result.status).toBe(ModuleCatalogStatus.active);
      });

      it('should allow valid transition active -> toBeDeprecated', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.active });
        mockRepo.updateStatus.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.toBeDeprecated });

        const statusDto: UpdateModuleStatusDto = { status: ModuleCatalogStatus.toBeDeprecated };
        const result = await service.updateStatus('services.bookings.create', statusDto);

        expect(result.status).toBe(ModuleCatalogStatus.toBeDeprecated);
      });

      it('should allow valid transition toBeDeprecated -> deprecated', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.toBeDeprecated });
        mockRepo.updateStatus.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.deprecated });

        const statusDto: UpdateModuleStatusDto = { status: ModuleCatalogStatus.deprecated };
        const result = await service.updateStatus('services.bookings.create', statusDto);

        expect(result.status).toBe(ModuleCatalogStatus.deprecated);
      });

      it('should allow idempotent update (same status)', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.active });
        mockRepo.updateStatus.mockResolvedValue({
          ...sampleEntry,
          status: ModuleCatalogStatus.active,
          maintenanceEnabled: true,
        });

        const statusDto: UpdateModuleStatusDto = {
          status: ModuleCatalogStatus.active,
          maintenanceEnabled: true,
        };
        const result = await service.updateStatus('services.bookings.create', statusDto);

        expect(result.status).toBe(ModuleCatalogStatus.active);
        expect(result.maintenanceEnabled).toBe(true);
      });

      it('should reject invalid transition draft -> deprecated', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.draft });

        const statusDto: UpdateModuleStatusDto = { status: ModuleCatalogStatus.deprecated };

        await expect(service.updateStatus('services.bookings.create', statusDto)).rejects.toThrow(BadRequestException);
        expect(mockRepo.updateStatus).not.toHaveBeenCalled();
      });

      it('should reject transitions from deprecated (terminal state)', async () => {
        mockRepo.findByKey.mockResolvedValue({ ...sampleEntry, status: ModuleCatalogStatus.deprecated });

        const statusDto: UpdateModuleStatusDto = { status: ModuleCatalogStatus.active };

        await expect(service.updateStatus('services.bookings.create', statusDto)).rejects.toThrow(BadRequestException);
      });

      it('should allow maintenance-only updates without status', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);
        mockRepo.updateStatus.mockResolvedValue({ ...sampleEntry, maintenanceEnabled: true });

        const statusDto: UpdateModuleStatusDto = { maintenanceEnabled: true };
        const result = await service.updateStatus('services.bookings.create', statusDto);

        expect(result.maintenanceEnabled).toBe(true);
        expect(mockRepo.updateStatus).toHaveBeenCalledWith(
          'services.bookings.create',
          expect.objectContaining({ maintenanceEnabled: true }),
        );
      });

      it('should reject inverted maintenance date range', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);

        const statusDto: UpdateModuleStatusDto = {
          maintenanceStartsAt: '2026-09-10T12:00:00Z',
          maintenanceEndsAt: '2026-09-09T12:00:00Z',
        };

        await expect(service.updateStatus('services.bookings.create', statusDto)).rejects.toThrow(
          BadRequestException,
        );
        expect(mockRepo.updateStatus).not.toHaveBeenCalled();
      });
    });

    describe('archive', () => {
      it('should soft-archive the entry by marking isArchived true', async () => {
        mockRepo.findByKey.mockResolvedValue(sampleEntry);
        mockRepo.archive.mockResolvedValue({ ...sampleEntry, isArchived: true });

        const result = await service.archive('services.bookings.create');

        expect(mockRepo.archive).toHaveBeenCalledWith('services.bookings.create');
        expect(result).toHaveProperty('message');
      });
    });
  });

  describe('ModulesController', () => {
    it('should route findAll to service.findAll', async () => {
      vi.spyOn(service, 'findAll').mockResolvedValue([sampleEntry]);
      const query = {
        kind: ModuleCatalogKind.feature,
        status: ModuleCatalogStatus.draft,
        sectionKey: 'services',
      };
      const res = await controller.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(res).toEqual([sampleEntry]);
    });

    it('should route getTree to service.getTree', async () => {
      const mockTree = { services: { bookings: [sampleEntry] } };
      vi.spyOn(service, 'getTree').mockResolvedValue(mockTree as any);
      const res = await controller.getTree();
      expect(service.getTree).toHaveBeenCalled();
      expect(res).toEqual(mockTree);
    });

    it('should route findOne to service.findByKey', async () => {
      vi.spyOn(service, 'findByKey').mockResolvedValue(sampleEntry);
      const res = await controller.findOne('services.bookings.create');
      expect(service.findByKey).toHaveBeenCalledWith('services.bookings.create');
      expect(res).toEqual(sampleEntry);
    });

    it('should route create to service.create', async () => {
      const dto: CreateModuleDto = {
        key: 'services.bookings.create',
        kind: ModuleCatalogKind.feature,
        moduleKey: 'bookings',
        sectionKey: 'services',
        name: 'Crear reservas',
      };
      vi.spyOn(service, 'create').mockResolvedValue(sampleEntry);
      const res = await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(res).toEqual(sampleEntry);
    });

    it('should route update to service.update', async () => {
      const dto: UpdateModuleDto = { name: 'Actualizado' };
      vi.spyOn(service, 'update').mockResolvedValue(sampleEntry);
      const res = await controller.update('services.bookings.create', dto);
      expect(service.update).toHaveBeenCalledWith('services.bookings.create', dto);
      expect(res).toEqual(sampleEntry);
    });

    it('should route updateStatus to service.updateStatus', async () => {
      const dto: UpdateModuleStatusDto = { status: ModuleCatalogStatus.active };
      vi.spyOn(service, 'updateStatus').mockResolvedValue(sampleEntry);
      const res = await controller.updateStatus('services.bookings.create', dto);
      expect(service.updateStatus).toHaveBeenCalledWith('services.bookings.create', dto);
      expect(res).toEqual(sampleEntry);
    });

    it('should route archive to service.archive', async () => {
      vi.spyOn(service, 'archive').mockResolvedValue({ message: 'Archived' });
      const res = await controller.archive('services.bookings.create');
      expect(service.archive).toHaveBeenCalledWith('services.bookings.create');
      expect(res).toEqual({ message: 'Archived' });
    });
  });

  describe('Contract Validator & Manifest Registry', () => {
    it('should validate a correct manifest contract and detect cycles', () => {
      const validModule = {
        key: 'bookings',
        label: 'Bookings Module',
        section: 'services',
        page: 'bookings',
        scope: 'tenant' as const,
        status: 'active' as const,
        compatibility: { minVersion: '1.0.0' },
        functions: [
          {
            key: 'bookings.create',
            label: 'Create booking',
            scope: 'tenant' as const,
            status: 'active' as const,
            compatibility: { minVersion: '1.0.0' },
          },
        ],
      };

      const manifest = defineCatalogManifest(validModule);
      expect(manifest.key).toBe('bookings');

      const contract = buildCatalogContract([manifest]);
      expect(contract.modules).toHaveLength(1);
      expect(contract.version).toBe('1.0.0');
    });

    it('should allow defining manifests with cross-domain dependencies at registration time', () => {
      const crossDepModule = {
        key: 'services.bookings.create',
        label: 'Create booking',
        section: 'services',
        page: 'bookings',
        scope: 'tenant' as const,
        status: 'active' as const,
        dependencies: ['services.bookings'],
        compatibility: { minVersion: '1.0.0' },
        functions: [
          {
            key: 'services.bookings.create.photo',
            label: 'Photo upload',
            scope: 'tenant' as const,
            status: 'active' as const,
            compatibility: { minVersion: '1.0.0' },
          },
        ],
      };

      const manifest = defineCatalogManifest(crossDepModule);
      expect(manifest.key).toBe('services.bookings.create');
    });

    it('should throw when contract has cyclic dependencies', () => {
      const cyclicContract = {
        version: '1.0.0',
        modules: [
          {
            key: 'module-a',
            label: 'Module A',
            section: 'services',
            page: 'a',
            scope: 'tenant' as const,
            status: 'active' as const,
            dependencies: ['module-b'],
            compatibility: { minVersion: '1.0.0' },
            functions: [
              {
                key: 'fn-a',
                label: 'Fn A',
                scope: 'tenant' as const,
                status: 'active' as const,
                compatibility: { minVersion: '1.0.0' },
              },
            ],
          },
          {
            key: 'module-b',
            label: 'Module B',
            section: 'services',
            page: 'b',
            scope: 'tenant' as const,
            status: 'active' as const,
            dependencies: ['module-a'],
            compatibility: { minVersion: '1.0.0' },
            functions: [
              {
                key: 'fn-b',
                label: 'Fn B',
                scope: 'tenant' as const,
                status: 'active' as const,
                compatibility: { minVersion: '1.0.0' },
              },
            ],
          },
        ],
      };

      expect(() => validateCatalogContract(cyclicContract)).toThrow(/dependency cycle detected/);
    });

    it('should throw on self dependency', () => {
      const selfDep = {
        version: '1.0.0',
        modules: [
          {
            key: 'module-self',
            label: 'Self Module',
            section: 'services',
            page: 'self',
            scope: 'tenant' as const,
            status: 'active' as const,
            dependencies: ['module-self'],
            compatibility: { minVersion: '1.0.0' },
            functions: [
              {
                key: 'fn-self',
                label: 'Fn Self',
                scope: 'tenant' as const,
                status: 'active' as const,
                compatibility: { minVersion: '1.0.0' },
              },
            ],
          },
        ],
      };

      expect(() => validateCatalogContract(selfDep)).toThrow(/cannot depend on itself/);
    });
  });
});
