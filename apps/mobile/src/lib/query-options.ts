/**
 * TanStack v5 `queryOptions()` factories — co-locate queryKey + queryFn +
 * options in one typed object so the most-duplicated queries have a single
 * source of truth (key AND fetcher AND staleTime/meta) shared across screens.
 *
 * Keys still flow through the central registry in `query-keys.ts`.
 */
import { AllMaintenanceTasksDocument, MeDocument } from '@motovault/graphql';
import { queryOptions } from '@tanstack/react-query';
import { gqlFetcher } from './graphql-client';
import { queryKeys } from './query-keys';

/**
 * Current-user (`me`) query. Defined once and reused by the navigation gate
 * and any screen that needs the authenticated user.
 */
export const meOptions = () =>
  queryOptions({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
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
