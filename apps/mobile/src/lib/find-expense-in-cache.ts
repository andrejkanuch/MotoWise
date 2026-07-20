import type { ExpensesByMotorcycleQuery } from '@motovault/graphql';
import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

export type CachedExpense = NonNullable<
  ExpensesByMotorcycleQuery['expenses']
>['categories'][number]['expenses'][number];

/**
 * Find an expense across year-keyed ExpensesByMotorcycle cache entries
 * (`[..., year]` / `[..., 0]` / dashboard). Prefers a hit that contains the id.
 */
export function findExpenseInCache(
  queryClient: QueryClient,
  motorcycleId: string,
  expenseId: string,
): { expense: CachedExpense; data: ExpensesByMotorcycleQuery } | undefined {
  const entries = queryClient.getQueriesData<ExpensesByMotorcycleQuery>({
    queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
  });

  for (const [, data] of entries) {
    if (!data?.expenses?.categories) continue;
    const expense = data.expenses.categories
      .flatMap((cat) => cat.expenses)
      .find((item) => item.id === expenseId);
    if (expense) return { expense, data };
  }
  return undefined;
}

export function flattenExpenses(data: ExpensesByMotorcycleQuery | undefined): CachedExpense[] {
  return data?.expenses?.categories.flatMap((cat) => cat.expenses) ?? [];
}
