import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ExpensesResolver } from './expenses.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no expense query/mutation is accidentally @Public().
 */
describe('ExpensesResolver auth guard audit', () => {
  const resolverPrototype = ExpensesResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = [
    'expenses',
    'expenseDashboard',
    'expensePhotos',
    'logExpense',
    'deleteExpense',
    'addExpensePhoto',
    'deleteExpensePhoto',
    'photos',
  ];

  describe('all methods require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
