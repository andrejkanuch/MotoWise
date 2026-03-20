import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ExpensesResolver } from './expenses.resolver';

/**
 * Guard audit: verify that all expense query/mutation handlers
 * have the correct auth guard configuration and none are accidentally public.
 */
describe('ExpensesResolver auth guard audit', () => {
  const resolverPrototype = ExpensesResolver.prototype;

  const getGuards = (methodName: string) => {
    const guards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    return guards;
  };

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  describe('protected queries (authentication required)', () => {
    it('expenses should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('expenses');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('expenses')).toBe(false);
    });

    it('expenseDashboard should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('expenseDashboard');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('expenseDashboard')).toBe(false);
    });
  });

  describe('protected mutations (authentication required)', () => {
    it('logExpense should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('logExpense');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('logExpense')).toBe(false);
    });

    it('deleteExpense should have GqlAuthGuard without @Public()', () => {
      const guards = getGuards('deleteExpense');
      expect(guards).toContain(GqlAuthGuard);
      expect(isPublic('deleteExpense')).toBe(false);
    });
  });

  describe('no methods are accidentally @Public()', () => {
    const allMethods = ['expenses', 'expenseDashboard', 'logExpense', 'deleteExpense'];

    for (const method of allMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
