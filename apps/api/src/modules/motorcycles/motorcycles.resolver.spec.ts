import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { OemSchedulesService } from '../oem-schedules/oem-schedules.service';
import { MotorcyclesResolver } from './motorcycles.resolver';
import type { MotorcyclesService } from './motorcycles.service';
import type { NhtsaService } from './nhtsa.service';

describe('MotorcyclesResolver', () => {
  const resolverPrototype = MotorcyclesResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  describe('auth guard audit', () => {
    const protectedMethods = [
      'myMotorcycles',
      'motorcycleMakes',
      'motorcycleModels',
      'createMotorcycle',
      'updateMotorcycle',
      'deleteMotorcycle',
    ];

    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
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
