/**
 * TanStack v5 `queryOptions()` factories — co-locate queryKey + queryFn +
 * options in one typed object so the most-duplicated queries have a single
 * source of truth (key AND fetcher AND staleTime/meta) shared across screens.
 *
 * Keys still flow through the central registry in `query-keys.ts`.
 */
import {
  AllMaintenanceTasksDocument,
  DocumentCategoriesDocument,
  ExpenseDashboardDocument,
  ExpensesByMotorcycleDocument,
  GetRideWaypointsDocument,
  MaintenanceTasksByMotorcycleDocument,
  MeDocument,
  MyMotorcyclesDocument,
  MyRidesForHeatmapDocument,
  type MyRidesForHeatmapQuery,
  type MyRidesForHeatmapQueryVariables,
} from '@motovault/graphql';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { HEATMAP_PAGE_SIZE } from '../utils/ride-constants';
import { getRequestSessionUserId, isAccountGoneError, signOutGoneAccount } from './account-gone';
import { gqlFetcher } from './graphql-client';
import { queryKeys } from './query-keys';

/**
 * Current-user (`me`) query. Defined once and reused by the navigation gate
 * and any screen that needs the authenticated user.
 */
export const meOptions = () =>
  queryOptions({
    queryKey: queryKeys.user.me,
    queryFn: async () => {
      // Whose `me` this is: a NOT_FOUND may only end the session that asked.
      const requestUserId = getRequestSessionUserId();
      try {
        return await gqlFetcher(MeDocument);
      } catch (error) {
        // The session's account no longer exists: leaving the rider signed in
        // strands them on screens that can only fail. Sign out instead.
        if (isAccountGoneError(error)) void signOutGoneAccount(requestUserId);
        throw error;
      }
    },
    retry: 1,
    retryDelay: 1000,
    meta: { showErrorAlert: false },
  });

/**
 * Garage maintenance badge — all of the user's maintenance tasks. Powers the
 * tab-bar badge count.
 */
export const maintenanceBadgeOptions = () =>
  queryOptions({
    queryKey: queryKeys.maintenanceTasks.allUser,
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
    meta: { showErrorAlert: false },
  });

/**
 * The rider's bike list. Fetched by Home and Garage, persisted across launches,
 * and read by two dozen screens, so it is nearly always a cache hit. Each site
 * adds its own `staleTime`, `enabled`, `select` and `meta`.
 */
export const motorcyclesOptions = () =>
  queryOptions({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

/**
 * The rider's document categories, with or without the hidden ones. The flag
 * is in the key under the `documents.categoriesAll` prefix, so one invalidation
 * refreshes both variants. Each site adds its own `meta`.
 */
export const documentCategoriesOptions = (includeHidden: boolean) =>
  queryOptions({
    queryKey: queryKeys.documents.categories(includeHidden),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden }),
  });

/**
 * One bike's maintenance tasks. Read by the hub shell, the task list, the
 * complete/edit/expense-detail screens (which seed `initialData` from this
 * same key), the health report and the pre-ride checklist. Each site adds its
 * own `enabled`, `initialData` and `meta`.
 */
export const maintenanceTasksOptions = (motorcycleId: string) =>
  queryOptions({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
  });

/**
 * A ride's route points, simplified to `maxPoints`. The count is in the key:
 * ride detail and the flyover ask for different resolutions, and under one key
 * per ride the second screen drew the first screen's points. A recorded route
 * never changes, so the entry never goes stale on its own.
 */
export const rideWaypointsOptions = (rideId: string, maxPoints: number) =>
  queryOptions({
    queryKey: queryKeys.rides.waypoints(rideId, maxPoints),
    queryFn: () => gqlFetcher(GetRideWaypointsDocument, { rideId, maxPoints }),
    staleTime: Number.POSITIVE_INFINITY,
  });

const HEATMAP_STALE_MS = 5 * 60 * 1000;

/**
 * Every ride's polyline for the heatmap, paged `HEATMAP_PAGE_SIZE` at a time.
 * The profile heatmap screen and the ride-tab heatmap hook both eagerly page
 * up to `HEATMAP_MAX_PAGES` — by far the heaviest ride query — so the entry
 * stays fresh for five minutes: re-entering the screen (or a sibling mounting
 * it) does not refetch every page. A ride save still invalidates `rides.all`
 * and marks it stale for the next view. The hook adds its own `enabled`.
 */
export const rideHeatmapOptions = () =>
  infiniteQueryOptions({
    queryKey: queryKeys.rides.heatmap,
    queryFn: ({ pageParam }) => {
      const variables: MyRidesForHeatmapQueryVariables = {
        first: HEATMAP_PAGE_SIZE,
        after: pageParam,
      };
      return gqlFetcher(MyRidesForHeatmapDocument, variables);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: MyRidesForHeatmapQuery) => {
      const pi = lastPage?.myRides?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? null) : null;
    },
    staleTime: HEATMAP_STALE_MS,
  });

/** The `year` variable of the expenses query that means every year. */
export const EXPENSES_ALL_YEARS = 0;

const EXPENSE_DASHBOARD_STALE_MS = 5 * 60 * 1000;

/**
 * One bike's expenses for one year (`EXPENSES_ALL_YEARS` for all of them). The
 * year is part of the key because the screens ask for different years: with a
 * bare per-bike key the dashboard (all years) and the health report (this year)
 * read whichever payload arrived first. Each site adds its own `enabled`,
 * `staleTime`, `placeholderData` and `meta`.
 */
export const expensesOptions = (motorcycleId: string, year: number) =>
  queryOptions({
    queryKey: queryKeys.expenses.byYear(motorcycleId, year),
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId, year }),
  });

/**
 * The expense dashboard aggregate for one bike: key, fetcher and staleTime.
 * Shared by the dashboard screen, the Get Started checklist's "first expense"
 * signal and the widget sync, so all of them read one cache entry under one
 * freshness rule.
 */
export const expenseDashboardQueryOptions = (motorcycleId: string) =>
  queryOptions({
    queryKey: queryKeys.expenses.dashboard(motorcycleId),
    queryFn: () => gqlFetcher(ExpenseDashboardDocument, { motorcycleId }),
    staleTime: EXPENSE_DASHBOARD_STALE_MS,
  });
