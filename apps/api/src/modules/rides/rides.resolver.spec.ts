import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { RidesResolver } from './rides.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no ride query/mutation is accidentally @Public()
 * (except getPublicRide which is intentionally public).
 */
describe('RidesResolver auth guard audit', () => {
  const resolverPrototype = RidesResolver.prototype;

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

  describe('all protected queries and mutations require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });

  describe('public queries', () => {
    it('getPublicRide should be @Public()', () => {
      expect(isPublic('getPublicRide')).toBe(true);
    });
  });
});
