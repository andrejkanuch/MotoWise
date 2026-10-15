// The `me` query is where a deleted account is noticed: NOT_FOUND must end the
// session (and still surface the error); every other failure must leave it alone.
// The expense factories must keep the cache entries their call sites already
// built by hand — the key arrays below are the literal arrays those sites wrote.

const mockFetcher = jest.fn();
const mockSignOutGone = jest.fn();
const mockRequestUser = jest.fn();

jest.mock('../graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../account-gone', () => ({
  // The real classification, without the module's store/Supabase imports.
  isAccountGoneError: (error: unknown) =>
    jest.requireActual('../graphql-errors').hasGraphQLCode(error, 'NOT_FOUND'),
  getRequestSessionUserId: () => mockRequestUser(),
  signOutGoneAccount: (...args: unknown[]) => mockSignOutGone(...args),
}));
jest.mock('../supabase', () => ({ supabase: { auth: {} } }));
jest.mock('../analytics', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));
jest.mock('@motovault/graphql', () => ({
  DocumentCategoriesDocument: 'DOCUMENT_CATEGORIES_DOC',
  MeDocument: 'ME_DOC',
  MyRidesForHeatmapDocument: 'HEATMAP_DOC',
  AllMaintenanceTasksDocument: 'TASKS_DOC',
  ExpensesByMotorcycleDocument: 'EXPENSES_DOC',
  ExpenseDashboardDocument: 'EXPENSE_DASHBOARD_DOC',
  GetRideWaypointsDocument: 'WAYPOINTS_DOC',
}));

import { hashKey } from '@tanstack/react-query';
import {
  documentCategoriesOptions,
  EXPENSES_ALL_YEARS,
  expenseDashboardQueryOptions,
  expensesOptions,
  meOptions,
  rideHeatmapOptions,
  rideWaypointsOptions,
} from '../query-options';

function gqlError(code: string) {
  return Object.assign(new Error('graphql error'), {
    response: { errors: [{ message: 'x', extensions: { code } }] },
  });
}

// biome-ignore lint/style/noNonNullAssertion: meOptions always defines queryFn
const runMe = () => (meOptions().queryFn as unknown as () => Promise<unknown>)!();

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestUser.mockReturnValue('user-a');
});

describe('meOptions queryFn', () => {
  it('returns the user on success without signing out', async () => {
    mockFetcher.mockResolvedValue({ me: { id: 'u1' } });
    await expect(runMe()).resolves.toEqual({ me: { id: 'u1' } });
    expect(mockSignOutGone).not.toHaveBeenCalled();
  });

  it('signs out once and rethrows when the account is gone (NOT_FOUND)', async () => {
    const error = gqlError('NOT_FOUND');
    // The session user is captured BEFORE the request: a switch while it is in
    // flight must not redirect the sign-out to the new account.
    mockRequestUser.mockReturnValueOnce('user-a').mockReturnValue('user-b');
    mockFetcher.mockRejectedValue(error);
    await expect(runMe()).rejects.toBe(error);
    expect(mockSignOutGone).toHaveBeenCalledTimes(1);
    // Bound to the session that sent the request, not whoever is signed in later.
    expect(mockSignOutGone).toHaveBeenCalledWith('user-a');
  });

  it.each([
    ['a server error', gqlError('INTERNAL_SERVER_ERROR')],
    ['an expired session', gqlError('UNAUTHENTICATED')],
    ['a network failure', new Error('Network request failed')],
  ])('keeps the session on %s', async (_label, error) => {
    mockFetcher.mockRejectedValue(error);
    await expect(runMe()).rejects.toBe(error);
    expect(mockSignOutGone).not.toHaveBeenCalled();
  });

  it('passes no user when the request carried no session (nothing to sign out)', async () => {
    mockRequestUser.mockReturnValue(null);
    mockFetcher.mockRejectedValue(gqlError('NOT_FOUND'));
    await expect(runMe()).rejects.toBeTruthy();
    expect(mockSignOutGone).toHaveBeenCalledWith(null);
  });
});

const runQueryFn = (options: { queryFn?: unknown }) =>
  (options.queryFn as () => Promise<unknown>)();

describe('expensesOptions', () => {
  it('keys a year under the per-bike prefix, as the hub and expense detail already did inline', () => {
    expect(hashKey(expensesOptions('bike-a', 2026).queryKey)).toBe(
      hashKey(['expenses', 'byMotorcycle', 'bike-a', 2026]),
    );
    expect(hashKey(expensesOptions('bike-a', EXPENSES_ALL_YEARS).queryKey)).toBe(
      hashKey(['expenses', 'byMotorcycle', 'bike-a', 0]),
    );
  });

  it('fetches the expenses document with the bike and the year', async () => {
    mockFetcher.mockResolvedValue({ expenses: { categories: [] } });
    await expect(runQueryFn(expensesOptions('bike-a', 2026))).resolves.toEqual({
      expenses: { categories: [] },
    });
    expect(mockFetcher).toHaveBeenCalledWith('EXPENSES_DOC', {
      motorcycleId: 'bike-a',
      year: 2026,
    });
  });

  it('carries no option of its own — enabled, staleTime and meta stay at the call site', () => {
    expect(Object.keys(expensesOptions('bike-a', 2026)).sort()).toEqual(['queryFn', 'queryKey']);
  });
});

describe('documentCategoriesOptions', () => {
  // Manage Categories reads the hidden ones too; every other screen does not.
  // One invalidation of the `categoriesAll` prefix must still refresh both.
  it('keys the hidden flag under the categoriesAll prefix, so true and false are two entries', () => {
    const withHidden = documentCategoriesOptions(true).queryKey;
    const visibleOnly = documentCategoriesOptions(false).queryKey;
    expect(hashKey(withHidden)).not.toBe(hashKey(visibleOnly));
    expect(withHidden.slice(0, 2)).toEqual(['documents', 'categories']);
    expect(visibleOnly.slice(0, 2)).toEqual(['documents', 'categories']);
  });

  it('fetches the categories document with the flag the key carries', async () => {
    mockFetcher.mockResolvedValue({ documentCategories: [] });
    const options = documentCategoriesOptions(true);
    await runQueryFn(options);
    expect(mockFetcher).toHaveBeenCalledWith('DOCUMENT_CATEGORIES_DOC', { includeHidden: true });
    expect(options.queryKey).toContain(true);
  });
});

describe('rideWaypointsOptions', () => {
  // Ride detail asks for 300 points and the flyover for 400. Under one key per
  // ride the second screen read the first screen's resolution.
  it('keys the point count, so 300 and 400 points are two entries under the rides prefix', () => {
    const detail = rideWaypointsOptions('ride-a', 300).queryKey;
    const flyover = rideWaypointsOptions('ride-a', 400).queryKey;
    expect(hashKey(detail)).not.toBe(hashKey(flyover));
    expect(detail.slice(0, 1)).toEqual(['rides']);
    expect(flyover.slice(0, 1)).toEqual(['rides']);
  });

  it('fetches the waypoints document with the ride id and the point count from the key', async () => {
    mockFetcher.mockResolvedValue({ rideWaypoints: [] });
    const options = rideWaypointsOptions('ride-a', 400);
    await runQueryFn(options);
    expect(mockFetcher).toHaveBeenCalledWith('WAYPOINTS_DOC', { rideId: 'ride-a', maxPoints: 400 });
    expect(options.queryKey).toContain('ride-a');
    expect(options.queryKey).toContain(400);
  });

  it('never goes stale on its own — a recorded route does not change', () => {
    expect(rideWaypointsOptions('ride-a', 300).staleTime).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('expenseDashboardQueryOptions', () => {
  it('keeps the key it had in hooks/use-expense-dashboard before the move', () => {
    expect(hashKey(expenseDashboardQueryOptions('bike-a').queryKey)).toBe(
      hashKey(['expenses', 'byMotorcycle', 'bike-a', 'dashboard']),
    );
  });

  it('keeps its five-minute staleTime and fetches the dashboard for the bike', async () => {
    const options = expenseDashboardQueryOptions('bike-a');
    expect(options.staleTime).toBe(5 * 60 * 1000);
    mockFetcher.mockResolvedValue({ expenseDashboard: { expenseCount: 1 } });
    await runQueryFn(options);
    expect(mockFetcher).toHaveBeenCalledWith('EXPENSE_DASHBOARD_DOC', { motorcycleId: 'bike-a' });
  });
});

describe('rideHeatmapOptions', () => {
  // The heatmap eagerly pages up to 20 x 50 rides, the heaviest ride query in
  // the app. The hook twin kept it fresh for five minutes; the profile screen's
  // inline copy carried no staleTime, so re-entering it refetched every page.
  it('keeps the heatmap fresh for five minutes', () => {
    expect(rideHeatmapOptions().staleTime).toBe(5 * 60 * 1000);
  });

  it('starts from no cursor and asks for a page of 50 rides after the cursor it is given', async () => {
    mockFetcher.mockResolvedValue({ myRides: { edges: [], pageInfo: {} } });
    const options = rideHeatmapOptions();
    expect(options.initialPageParam).toBeNull();
    await options.queryFn({ pageParam: 'cursor-1' } as never);
    expect(mockFetcher).toHaveBeenCalledWith('HEATMAP_DOC', { first: 50, after: 'cursor-1' });
  });

  it('pages on from the end cursor while there is a next page, and stops with null', () => {
    const { getNextPageParam } = rideHeatmapOptions();
    const page = (hasNextPage: boolean) => ({
      myRides: { edges: [], pageInfo: { hasNextPage, endCursor: 'cursor-2' } },
    });
    const more = page(true);
    const last = page(false);
    expect(getNextPageParam(more, [more], null, [null])).toBe('cursor-2');
    expect(getNextPageParam(last, [last], null, [null])).toBeNull();
  });
});
