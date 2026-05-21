import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { RideSummariesResolver } from './ride-summaries.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no ride summary mutation is accidentally @Public().
 */
describe('RideSummariesResolver auth guard audit', () => {
  const resolverPrototype = RideSummariesResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = ['regenerateRideSummary'];

  describe('all mutations require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
