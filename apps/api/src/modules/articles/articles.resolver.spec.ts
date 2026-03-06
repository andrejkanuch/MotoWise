import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ArticlesResolver } from './articles.resolver';
import type { ArticlesService } from './articles.service';

function createMockService() {
  return {
    search: vi.fn(),
    findBySlug: vi.fn(),
  };
}

describe('ArticlesResolver', () => {
  let resolver: ArticlesResolver;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    resolver = new ArticlesResolver(service as unknown as ArticlesService);
  });

  describe('searchArticles', () => {
    it('should delegate to articlesService.search with input', async () => {
      const input = { query: 'oil change', first: 10 };
      const expected = { edges: [], pageInfo: { hasNextPage: false } };
      service.search.mockResolvedValue(expected);

      const result = await resolver.searchArticles(input as any);

      expect(service.search).toHaveBeenCalledWith(input);
      expect(result).toEqual(expected);
    });
  });

  describe('articleBySlug', () => {
    it('should delegate to articlesService.findBySlug with slug', async () => {
      const expected = { id: 'a1', slug: 'oil-change-guide', title: 'Oil Change' };
      service.findBySlug.mockResolvedValue(expected);

      const result = await resolver.articleBySlug('oil-change-guide');

      expect(service.findBySlug).toHaveBeenCalledWith('oil-change-guide');
      expect(result).toEqual(expected);
    });

    it('should return null when article not found', async () => {
      service.findBySlug.mockResolvedValue(null);

      const result = await resolver.articleBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('decorator metadata', () => {
    // Articles resolver intentionally has NO auth guard — it is a public endpoint.
    it('should NOT have GqlAuthGuard on searchArticles (public endpoint)', () => {
      const methodGuards = Reflect.getMetadata(
        '__guards__',
        ArticlesResolver.prototype.searchArticles,
      );
      const classGuards = Reflect.getMetadata('__guards__', ArticlesResolver);
      const allGuards = [...(methodGuards ?? []), ...(classGuards ?? [])];
      const hasAuthGuard = allGuards.some(
        (g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard',
      );
      expect(hasAuthGuard).toBe(false);
    });

    it('should NOT have GqlAuthGuard on articleBySlug (public endpoint)', () => {
      const methodGuards = Reflect.getMetadata(
        '__guards__',
        ArticlesResolver.prototype.articleBySlug,
      );
      const classGuards = Reflect.getMetadata('__guards__', ArticlesResolver);
      const allGuards = [...(methodGuards ?? []), ...(classGuards ?? [])];
      const hasAuthGuard = allGuards.some(
        (g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard',
      );
      expect(hasAuthGuard).toBe(false);
    });
  });
});
