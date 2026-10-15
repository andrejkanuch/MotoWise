// The dashboard asks for every year and the health report for this year. Both
// used to store their payload under the bare per-bike key, so whichever screen
// loaded second read the other's list: the dashboard's category drill-down
// showed only this year, the health report counted all years. With the year in
// the key each screen gets its own entry, and the per-bike prefix still
// invalidates all of them, dashboard aggregate included.

const mockFetcher = jest.fn();
jest.mock('../graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../account-gone', () => ({
  isAccountGoneError: () => false,
  getRequestSessionUserId: () => null,
  signOutGoneAccount: jest.fn(),
}));
jest.mock('../analytics', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));

import { ExpenseDashboardDocument, ExpensesByMotorcycleDocument } from '@motovault/graphql';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../query-keys';
import {
  EXPENSES_ALL_YEARS,
  expenseDashboardQueryOptions,
  expensesOptions,
} from '../query-options';

const BIKE = 'bike-a';
const CURRENT_YEAR = 2026;

const THIS_YEAR_LIST = {
  expenses: { categories: [{ category: 'fuel', expenses: [{ id: 'e-2026' }] }] },
};
const ALL_YEARS_LIST = {
  expenses: {
    categories: [{ category: 'fuel', expenses: [{ id: 'e-2026' }, { id: 'e-2024' }] }],
  },
};
const DASHBOARD = { expenseDashboard: { expenseCount: 2 } };

function serve(document: unknown, variables: { year?: number } | undefined) {
  if (document === ExpenseDashboardDocument) return Promise.resolve(DASHBOARD);
  if (document !== ExpensesByMotorcycleDocument) throw new Error('unexpected document');
  return Promise.resolve(variables?.year === EXPENSES_ALL_YEARS ? ALL_YEARS_LIST : THIS_YEAR_LIST);
}

let queryClient: QueryClient;

beforeEach(() => {
  mockFetcher.mockReset();
  mockFetcher.mockImplementation(serve);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  queryClient.clear();
});

describe('expenses per bike are cached per requested year', () => {
  it('the health report (this year) and the dashboard (all years) each fetch and read their own list', async () => {
    const healthReport = expensesOptions(BIKE, CURRENT_YEAR);
    const dashboard = expensesOptions(BIKE, EXPENSES_ALL_YEARS);

    await expect(queryClient.fetchQuery(healthReport)).resolves.toEqual(THIS_YEAR_LIST);
    await expect(queryClient.fetchQuery(dashboard)).resolves.toEqual(ALL_YEARS_LIST);

    expect(mockFetcher).toHaveBeenCalledTimes(2);
    expect(mockFetcher).toHaveBeenNthCalledWith(1, ExpensesByMotorcycleDocument, {
      motorcycleId: BIKE,
      year: CURRENT_YEAR,
    });
    expect(mockFetcher).toHaveBeenNthCalledWith(2, ExpensesByMotorcycleDocument, {
      motorcycleId: BIKE,
      year: EXPENSES_ALL_YEARS,
    });

    // The second screen's payload did not overwrite the first screen's entry.
    expect(queryClient.getQueryData(healthReport.queryKey)).toEqual(THIS_YEAR_LIST);
    expect(queryClient.getQueryData(dashboard.queryKey)).toEqual(ALL_YEARS_LIST);
  });

  it('invalidating the per-bike prefix marks both year entries and the dashboard aggregate stale', async () => {
    const thisYear = expensesOptions(BIKE, CURRENT_YEAR);
    const allYears = expensesOptions(BIKE, EXPENSES_ALL_YEARS);
    const aggregate = expenseDashboardQueryOptions(BIKE);
    await Promise.all([
      queryClient.fetchQuery(thisYear),
      queryClient.fetchQuery(allYears),
      queryClient.fetchQuery(aggregate),
    ]);
    expect(mockFetcher).toHaveBeenCalledTimes(3);

    await queryClient.invalidateQueries({
      queryKey: queryKeys.expenses.byMotorcycle(BIKE),
      refetchType: 'none',
    });

    for (const { queryKey } of [thisYear, allYears, aggregate]) {
      expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    // Another bike's entries are untouched.
    const otherBike = expensesOptions('bike-b', CURRENT_YEAR);
    await queryClient.fetchQuery(otherBike);
    expect(queryClient.getQueryState(otherBike.queryKey)?.isInvalidated).toBe(false);
  });
});
