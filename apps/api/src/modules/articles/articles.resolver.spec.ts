import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ArticlesResolver } from './articles.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify public queries have @Public() and protected mutations do not.
 */
describe('ArticlesResolver auth guard audit', () => {
  const resolverPrototype = ArticlesResolver.prototype;

  const isPublic = (methodName: string) => {
    return (
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        (resolverPrototype as unknown as Record<string, unknown>)[methodName] as object,
      ) === true
    );
  };

  describe('public queries (intentionally unauthenticated)', () => {
    it('searchArticles should be @Public()', () => {
      expect(isPublic('searchArticles')).toBe(true);
    });

    it('articleBySlug should be @Public()', () => {
      expect(isPublic('articleBySlug')).toBe(true);
    });

    it('articleBySlugFull should be @Public()', () => {
      expect(isPublic('articleBySlugFull')).toBe(true);
    });
  });

  describe('protected mutations (authentication required)', () => {
    it('generateArticle should NOT be @Public()', () => {
      expect(isPublic('generateArticle')).toBe(false);
    });
  });
});
