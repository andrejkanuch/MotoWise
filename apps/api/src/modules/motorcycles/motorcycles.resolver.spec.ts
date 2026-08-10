import type { SupabaseClient } from '@supabase/supabase-js';
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
    // User-scoped reads/writes — must require a JWT.
    const protectedMethods = [
      'myMotorcycles',
      'createMotorcycle',
      'updateMotorcycle',
      'deleteMotorcycle',
      'motorcycleRecalls',
    ];

    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }

    // Public read-only catalog/aggregate queries — consumed during
    // anonymous-first onboarding (bike-setup runs before the account step), so
    // they must NOT require a JWT. NHTSA catalog data is public; makeStats is
    // aggregate fleet counts already exposed via the @Public() onboarding reveal.
    const publicMethods = ['motorcycleMakes', 'motorcycleModels', 'makeStats'];

    for (const method of publicMethods) {
      it(`${method} should be @Public()`, () => {
        expect(isPublic(method)).toBe(true);
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

    const mockMakeStatsService = { getMakeStats: vi.fn() } as never;
    // Never exercised — these cases only assert guard metadata, not query behavior.
    const mockSupabase = {} as unknown as SupabaseClient;

    beforeEach(() => {
      vi.clearAllMocks();
      resolver = new MotorcyclesResolver(
        mockMotorcyclesService,
        mockMakeStatsService,
        mockNhtsaService,
        mockOemSchedulesService,
        { load: vi.fn().mockResolvedValue([]) } as never,
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
        null, // engineCc
        0, // currentMileage
        undefined, // scheduleIdFilter
        null, // variant
      );
    });
  });
});
