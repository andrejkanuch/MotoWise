import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { FollowsResolver } from './follows.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no follow query/mutation is accidentally @Public().
 */
describe('FollowsResolver auth guard audit', () => {
  const resolverPrototype = FollowsResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = ['followRider', 'unfollowRider', 'getFollowers', 'getFollowing'];

  describe('all queries and mutations require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
