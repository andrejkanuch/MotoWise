import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { LearningProgressResolver } from './learning-progress.resolver';
import type { LearningProgressService } from './learning-progress.service';

function createMockService() {
  return {
    findByUser: vi.fn(),
    markRead: vi.fn(),
  };
}

describe('LearningProgressResolver', () => {
  let resolver: LearningProgressResolver;
  let service: ReturnType<typeof createMockService>;
  const mockUser: AuthUser = { id: 'user-1', email: 'test@example.com', role: 'rider' };

  beforeEach(() => {
    service = createMockService();
    resolver = new LearningProgressResolver(service as unknown as LearningProgressService);
  });

  describe('myProgress', () => {
    it('should delegate to progressService.findByUser with user id', async () => {
      const expected = [{ id: 'prog-1', articleId: 'art-1', completed: true }];
      service.findByUser.mockResolvedValue(expected);

      const result = await resolver.myProgress(mockUser);

      expect(service.findByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('markArticleRead', () => {
    it('should delegate to progressService.markRead with user id and articleId', async () => {
      const expected = { id: 'prog-2', articleId: 'art-2', completed: true };
      service.markRead.mockResolvedValue(expected);

      const result = await resolver.markArticleRead(mockUser, 'art-2');

      expect(service.markRead).toHaveBeenCalledWith('user-1', 'art-2');
      expect(result).toEqual(expected);
    });
  });

  describe('decorator metadata', () => {
    it('should have GqlAuthGuard on myProgress', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        LearningProgressResolver.prototype.myProgress,
      );
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });

    it('should have GqlAuthGuard on markArticleRead', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        LearningProgressResolver.prototype.markArticleRead,
      );
      expect(guards).toBeDefined();
      const hasAuthGuard = guards.some((g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard');
      expect(hasAuthGuard).toBe(true);
    });
  });
});
