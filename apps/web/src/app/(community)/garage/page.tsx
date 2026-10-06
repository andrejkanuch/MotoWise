import {
  AllMaintenanceTasksDocument,
  ExpenseDashboardDocument,
  GetRideTotalsThisYearDocument,
  GetServiceSpendThisYearDocument,
  MeDocument,
  MyMotorcyclesDocument,
  SavedTripsDocument,
} from '@motovault/graphql';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { gqlServerFetcherAuthed } from '@/lib/graphql-server';
import { GarageDashboard } from './garage-dashboard';
import { garageQueryKeys } from './query-keys';

/**
 * Server entry for /garage. Prefetches the dashboard's data with the user's
 * forwarded JWT, dehydrates the cache, and hands it to the client dashboard via
 * HydrationBoundary so it paints with content on first render (no spinner gate).
 *
 * Auth is already enforced by (community)/layout.tsx (redirects unauthenticated
 * users), so a session is expected here. Prefetch failures degrade gracefully:
 * fetchQuery errors are caught and prefetchQuery swallows them, so only
 * successful queries dehydrate and the client refetches anything missing.
 *
 * Query keys MUST stay identical to the useQuery keys in garage-dashboard.tsx,
 * or the dehydrated cache won't match and the client would refetch (reintro the
 * flash).
 */
export default async function GaragePage() {
  const queryClient = new QueryClient();

  // Level 1 — independent. Bikes are fetched into the cache AND read back so we
  // can resolve the dependent queries' keys (primary bike id, first bike id).
  const [, bikesData] = await Promise.all([
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.me,
      queryFn: () => gqlServerFetcherAuthed(MeDocument),
    }),
    queryClient
      .fetchQuery({
        queryKey: garageQueryKeys.motorcycles,
        queryFn: () => gqlServerFetcherAuthed(MyMotorcyclesDocument),
      })
      .catch(() => null),
  ]);

  const bikes = bikesData?.myMotorcycles ?? [];
  const primaryBike = bikes.find((b) => b.isPrimary) ?? bikes[0];
  const firstBike = bikes[0];

  // Level 2 — depends on level-1 results. Keys mirror garage-dashboard.tsx and
  // garage-summary.tsx exactly (expenses is keyed by the resolved primary bike
  // id). Service spend is prefetched for the first bike only: the server does
  // not know the Pro status, and the first bike is the one every rider sees.
  await Promise.all([
    primaryBike
      ? queryClient.prefetchQuery({
          queryKey: garageQueryKeys.expenses(primaryBike.id),
          queryFn: () =>
            gqlServerFetcherAuthed(ExpenseDashboardDocument, { motorcycleId: primaryBike.id }),
        })
      : Promise.resolve(),
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.maintenance,
      queryFn: () => gqlServerFetcherAuthed(AllMaintenanceTasksDocument),
    }),
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.trips,
      queryFn: () => gqlServerFetcherAuthed(SavedTripsDocument, { first: 10 }),
    }),
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.rideTotals,
      queryFn: () => gqlServerFetcherAuthed(GetRideTotalsThisYearDocument),
    }),
    firstBike
      ? queryClient.prefetchQuery({
          queryKey: garageQueryKeys.serviceSpend(firstBike.id),
          queryFn: () =>
            gqlServerFetcherAuthed(GetServiceSpendThisYearDocument, { motorcycleId: firstBike.id }),
        })
      : Promise.resolve(),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GarageDashboard />
    </HydrationBoundary>
  );
}
