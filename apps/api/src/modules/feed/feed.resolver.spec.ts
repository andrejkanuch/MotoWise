import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { FeedResolver } from './feed.resolver';

/**
 * Guard audit: verify that all feed query handlers
 * have GqlAuthGuard and none are accidentally @Public().
 */
describe('FeedResolver auth guard audit', () => {
  const resolverPrototype = FeedResolver.prototype;

  const getGuards = (methodName: string) => {
    const methodGuards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    const classGuards = Reflect.getMetadata('__guards__', FeedResolver) ?? [];
    return [...methodGuards, ...classGuards];
  };

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = ['rideFeed'];

  describe('all queries require authentication', () => {
    for (const method of protectedMethods) {
      it(`${method} should have GqlAuthGuard`, () => {
        const guards = getGuards(method);
        expect(guards).toContain(GqlAuthGuard);
      });

      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
