import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { RidesResolver } from './rides.resolver';

/**
 * Guard audit: verify that all ride query/mutation handlers
 * have GqlAuthGuard and none are accidentally @Public().
 */
describe('RidesResolver auth guard audit', () => {
  const resolverPrototype = RidesResolver.prototype;

  const getGuards = (methodName: string) => {
    // Check method-level guards first, then fall back to class-level guards
    const methodGuards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    const classGuards = Reflect.getMetadata('__guards__', RidesResolver) ?? [];
    return [...methodGuards, ...classGuards];
  };

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = [
    'startRide',
    'endRide',
    'uploadWaypoints',
    'updateRide',
    'deleteRide',
    'myRides',
    'ride',
  ];

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
