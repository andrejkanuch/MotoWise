import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { FollowsResolver } from './follows.resolver';

/**
 * Guard audit: verify that all follow query/mutation handlers
 * have GqlAuthGuard and none are accidentally @Public().
 */
describe('FollowsResolver auth guard audit', () => {
  const resolverPrototype = FollowsResolver.prototype;

  const getGuards = (methodName: string) => {
    const methodGuards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    const classGuards = Reflect.getMetadata('__guards__', FollowsResolver) ?? [];
    return [...methodGuards, ...classGuards];
  };

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = ['followRider', 'unfollowRider', 'getFollowers', 'getFollowing'];

  describe('all queries and mutations require authentication', () => {
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
