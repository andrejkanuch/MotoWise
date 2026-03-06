import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MotorcyclesResolver } from './motorcycles.resolver';
import type { MotorcyclesService } from './motorcycles.service';

function createMockService() {
  return {
    findByUser: vi.fn(),
    create: vi.fn(),
  };
}

describe('MotorcyclesResolver', () => {
  let resolver: MotorcyclesResolver;
  let service: ReturnType<typeof createMockService>;
  const mockUser: AuthUser = { id: 'user-1', email: 'rider@example.com', role: 'rider' };

  beforeEach(() => {
    service = createMockService();
    resolver = new MotorcyclesResolver(service as unknown as MotorcyclesService);
  });

  describe('myMotorcycles', () => {
    it('should delegate to motorcyclesService.findByUser with user id', async () => {
      const expected = [{ id: 'moto-1', make: 'Honda' }];
      service.findByUser.mockResolvedValue(expected);

      const result = await resolver.myMotorcycles(mockUser);

      expect(service.findByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('createMotorcycle', () => {
    it('should delegate to motorcyclesService.create with user id and input', async () => {
      const input = { make: 'Yamaha', model: 'MT-07', year: 2024 };
      const expected = { id: 'moto-2', ...input };
      service.create.mockResolvedValue(expected);

      const result = await resolver.createMotorcycle(mockUser, input as any);

      expect(service.create).toHaveBeenCalledWith('user-1', input);
      expect(result).toEqual(expected);
    });
  });

  describe('decorator metadata', () => {
    it('should have GqlAuthGuard on myMotorcycles', () => {
      const guards = Reflect.getMetadata('__guards__', MotorcyclesResolver.prototype.myMotorcycles);
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have GqlAuthGuard on createMotorcycle', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        MotorcyclesResolver.prototype.createMotorcycle,
      );
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have ZodValidationPipe on createMotorcycle input arg', () => {
      const params = Reflect.getMetadata(
        '__routeArguments__',
        MotorcyclesResolver,
        'createMotorcycle',
      );
      expect(params).toBeDefined();
      const paramValues = Object.values(params) as any[];
      const hasPipe = paramValues.some((p: any) =>
        p.pipes?.some((pipe: any) => pipe instanceof ZodValidationPipe),
      );
      expect(hasPipe).toBe(true);
    });
  });
});
