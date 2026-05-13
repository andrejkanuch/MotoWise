import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import type { OemSchedulesService } from '../oem-schedules/oem-schedules.service';
import { MotorcyclesResolver } from './motorcycles.resolver';
import type { MotorcyclesService } from './motorcycles.service';
import type { NhtsaService } from './nhtsa.service';

describe('MotorcyclesResolver', () => {
  const resolverPrototype = MotorcyclesResolver.prototype;

  const getGuards = (methodName: string) => {
    const guards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    return guards;
  };

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  describe('auth guard audit', () => {
    it('myMotorcycles should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('myMotorcycles');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('myMotorcycles')).toBe(false);
    });

    it('motorcycleMakes should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('motorcycleMakes');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('motorcycleMakes')).toBe(false);
    });

    it('motorcycleModels should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('motorcycleModels');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('motorcycleModels')).toBe(false);
    });

    it('createMotorcycle should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('createMotorcycle');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('createMotorcycle')).toBe(false);
    });

    it('updateMotorcycle should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('updateMotorcycle');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('updateMotorcycle')).toBe(false);
    });

    it('deleteMotorcycle should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('deleteMotorcycle');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('deleteMotorcycle')).toBe(false);
    });
  });

  describe('createMotorcycle behavior', () => {
    let resolver: MotorcyclesResolver;
    const mockMotorcycle = {
      id: 'moto-1',
      userId: 'user-1',
      make: 'Honda',
      model: 'CB500F',
      year: 2023,
      isPrimary: false,
      createdAt: '2024-01-01T00:00:00Z',
    };

    const mockMotorcyclesService = {
      create: vi.fn().mockResolvedValue(mockMotorcycle),
      findByUser: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    } as unknown as MotorcyclesService;

    const mockNhtsaService = {
      getMakes: vi.fn(),
      getModels: vi.fn(),
    } as unknown as NhtsaService;

    const mockOemSchedulesService = {
      autoPopulateForBike: vi.fn(),
    } as unknown as OemSchedulesService;

    const mockSupabase = {} as any;

    beforeEach(() => {
      vi.clearAllMocks();
      resolver = new MotorcyclesResolver(
        mockMotorcyclesService,
        mockNhtsaService,
        mockOemSchedulesService,
        mockSupabase,
      );
    });

    it('should still return motorcycle when oemSchedulesService.autoPopulateForBike throws', async () => {
      (mockOemSchedulesService.autoPopulateForBike as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('OEM populate failed'),
      );

      const user = { id: 'user-1', email: 'test@test.com' };
      const input = { make: 'Honda', model: 'CB500F', year: 2023 };

      const result = await resolver.createMotorcycle(user, input);

      expect(result).toEqual(mockMotorcycle);
      expect(mockOemSchedulesService.autoPopulateForBike).toHaveBeenCalledWith(
        mockSupabase,
        'user-1',
        'moto-1',
        'Honda',
        'CB500F',
        2023,
        null,
      );
    });
  });
});
