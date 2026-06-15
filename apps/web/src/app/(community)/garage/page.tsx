import {
  AllMaintenanceTasksDocument,
  ExpenseDashboardDocument,
  GetRiderProfileDocument,
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

  // Level 1 — independent. Fetch into the cache AND read back so we can resolve
  // the dependent queries' keys (primary bike id, public username).
  const [meData, bikesData] = await Promise.all([
    queryClient
      .fetchQuery({
        queryKey: garageQueryKeys.me,
        queryFn: () => gqlServerFetcherAuthed(MeDocument),
      })
      .catch(() => null),
    queryClient
      .fetchQuery({
        queryKey: garageQueryKeys.motorcycles,
        queryFn: () => gqlServerFetcherAuthed(MyMotorcyclesDocument),
      })
      .catch(() => null),
  ]);

  const bikes = bikesData?.myMotorcycles ?? [];
  const primaryBike = bikes.find((b) => b.isPrimary) ?? bikes[0];
  const username = meData?.me?.publicUsername;

  // Level 2 — depends on level-1 results. Keys mirror garage-dashboard.tsx
  // exactly (expenses is keyed by the resolved primary bike id; profile by the
  // public username), matching the client's `enabled`-gated queries.
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
    username
      ? queryClient.prefetchQuery({
          queryKey: garageQueryKeys.profile(username),
          queryFn: () => gqlServerFetcherAuthed(GetRiderProfileDocument, { username }),
        })
      : Promise.resolve(),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GarageDashboard />
    </HydrationBoundary>
  );
}
