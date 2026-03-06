import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContentFlagsResolver } from './content-flags.resolver';
import type { ContentFlagsService } from './content-flags.service';

function createMockService() {
  return {
    create: vi.fn(),
  };
}

describe('ContentFlagsResolver', () => {
  let resolver: ContentFlagsResolver;
  let service: ReturnType<typeof createMockService>;
  const mockUser: AuthUser = { id: 'user-1', email: 'test@example.com', role: 'rider' };

  beforeEach(() => {
    service = createMockService();
    resolver = new ContentFlagsResolver(service as unknown as ContentFlagsService);
  });

  describe('createFlag', () => {
    it('should delegate to contentFlagsService.create with user id and input', async () => {
      const input = { articleId: 'art-1', reason: 'inaccurate' };
      const expected = { id: 'flag-1', ...input, userId: 'user-1' };
      service.create.mockResolvedValue(expected);

      const result = await resolver.createFlag(mockUser, input as any);

      expect(service.create).toHaveBeenCalledWith('user-1', input);
      expect(result).toEqual(expected);
    });
  });

  describe('decorator metadata', () => {
    it('should have GqlAuthGuard on createFlag', () => {
      const guards = Reflect.getMetadata('__guards__', ContentFlagsResolver.prototype.createFlag);
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have ZodValidationPipe on createFlag input arg', () => {
      const params = Reflect.getMetadata('__routeArguments__', ContentFlagsResolver, 'createFlag');
      expect(params).toBeDefined();
      const paramValues = Object.values(params) as any[];
      const hasPipe = paramValues.some((p: any) =>
        p.pipes?.some((pipe: any) => pipe instanceof ZodValidationPipe),
      );
      expect(hasPipe).toBe(true);
    });
  });
});
