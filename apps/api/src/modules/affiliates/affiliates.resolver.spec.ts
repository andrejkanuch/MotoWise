import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AffiliatesResolver } from './affiliates.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no affiliate mutation is accidentally @Public().
 */
describe('AffiliatesResolver auth guard audit', () => {
  const resolverPrototype = AffiliatesResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = ['trackAffiliateClick'];

  describe('all mutations require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
