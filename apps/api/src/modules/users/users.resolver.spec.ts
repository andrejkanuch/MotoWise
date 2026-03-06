import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersResolver } from './users.resolver';
import type { UsersService } from './users.service';

function createMockService() {
  return {
    findById: vi.fn(),
    update: vi.fn(),
  };
}

describe('UsersResolver', () => {
  let resolver: UsersResolver;
  let service: ReturnType<typeof createMockService>;
  const mockUser: AuthUser = { id: 'user-1', email: 'test@example.com', role: 'rider' };

  beforeEach(() => {
    service = createMockService();
    resolver = new UsersResolver(service as unknown as UsersService);
  });

  describe('me', () => {
    it('should delegate to usersService.findById with user id', async () => {
      const expected = { id: 'user-1', email: 'test@example.com' };
      service.findById.mockResolvedValue(expected);

      const result = await resolver.me(mockUser);

      expect(service.findById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('user', () => {
    it('should delegate to usersService.findById with auth user id', async () => {
      const expected = { id: 'user-1', email: 'test@example.com' };
      service.findById.mockResolvedValue(expected);

      const result = await resolver.user(mockUser);

      expect(service.findById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('updateUser', () => {
    it('should delegate to usersService.update with user id and input', async () => {
      const input = { fullName: 'Updated Name' };
      const expected = { id: 'user-1', fullName: 'Updated Name' };
      service.update.mockResolvedValue(expected);

      const result = await resolver.updateUser(mockUser, input as any);

      expect(service.update).toHaveBeenCalledWith('user-1', input);
      expect(result).toEqual(expected);
    });
  });

  describe('decorator metadata', () => {
    it('should have GqlAuthGuard on me', () => {
      const guards = Reflect.getMetadata('__guards__', UsersResolver.prototype.me);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have GqlAuthGuard on user', () => {
      const guards = Reflect.getMetadata('__guards__', UsersResolver.prototype.user);
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have GqlAuthGuard on updateUser', () => {
      const guards = Reflect.getMetadata('__guards__', UsersResolver.prototype.updateUser);
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have ZodValidationPipe on updateUser input arg', () => {
      const params = Reflect.getMetadata('__routeArguments__', UsersResolver, 'updateUser');
      expect(params).toBeDefined();
      const paramValues = Object.values(params) as any[];
      const hasPipe = paramValues.some((p: any) =>
        p.pipes?.some((pipe: any) => pipe instanceof ZodValidationPipe),
      );
      expect(hasPipe).toBe(true);
    });
  });
});
