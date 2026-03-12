import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ArticlesResolver } from './articles.resolver';

/**
 * Integration test: verify that all article query/mutation handlers
 * have the correct auth guard configuration.
 */
describe('ArticlesResolver auth guard audit', () => {
  const resolverPrototype = ArticlesResolver.prototype;

  const getGuards = (methodName: string) => {
    const guards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    return guards;
  };

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  describe('public queries (intentionally unauthenticated)', () => {
    it('searchArticles should have GqlAuthGuard and @Public()', () => {
      const guards = getGuards('searchArticles');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('searchArticles')).toBe(true);
    });

    it('articleBySlug should have GqlAuthGuard and @Public()', () => {
      const guards = getGuards('articleBySlug');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('articleBySlug')).toBe(true);
    });

    it('articleBySlugFull should have GqlAuthGuard and @Public()', () => {
      const guards = getGuards('articleBySlugFull');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('articleBySlugFull')).toBe(true);
    });
  });

  describe('protected mutations (authentication required)', () => {
    it('generateArticle should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('generateArticle');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('generateArticle')).toBe(false);
    });
  });
});
