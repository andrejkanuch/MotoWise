import {
  AllMaintenanceTasksDocument,
  ExpenseDashboardDocument,
  GetRiderProfileDocument,
  MeDocument,
  MyMotorcyclesDocument,
  MyRideCountDocument,
  RideOverviewDocument,
} from '@motovault/graphql';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { signInMethodFromProvider } from '@/components/garage-ui/handoff';
import { gqlServerFetcherAuthed } from '@/lib/graphql-server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { isoDayUtc, pickLeadBike } from './garage-model';
import { GarageView } from './garage-view';
import { garageQueryKeys } from './query-keys';

/**
 * Server entry for /garage: the read-only garage. Prefetches every card's data
 * with the user's forwarded JWT, dehydrates the cache, and hands it to the
 * client view via HydrationBoundary, so it paints with content on first render.
 *
 * Auth is enforced by (community)/layout.tsx (redirects unauthenticated users).
 * Prefetch failures degrade gracefully: fetchQuery errors are caught and
 * prefetchQuery swallows them, so only successful queries dehydrate and the
 * client refetches (and shows its skeleton for) anything missing.
 *
 * No loading.tsx may sit above this route (see the 404 contract in CLAUDE.md).
 */
export default async function GaragePage() {
  const queryClient = new QueryClient();

  // Level 1: independent. Fetch into the cache AND read back so the dependent
  // keys (lead bike id, public username) can be resolved.
  const [meData, bikesData, session] = await Promise.all([
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
    // Display only (which sign-in button to name in the handoff); the session
    // was already verified by the layout. getSession reads the cookie, no network.
    getSupabaseServerClient()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data }) => data.session)
      .catch(() => null),
  ]);

  const lead = pickLeadBike(bikesData?.myMotorcycles ?? []);
  const username = meData?.me?.publicUsername;

  // Level 2: keys mirror garage-view.tsx exactly.
  await Promise.all([
    lead
      ? queryClient.prefetchQuery({
          queryKey: garageQueryKeys.expenses(lead.id),
          queryFn: () =>
            gqlServerFetcherAuthed(ExpenseDashboardDocument, { motorcycleId: lead.id }),
        })
      : Promise.resolve(),
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.maintenance,
      queryFn: () => gqlServerFetcherAuthed(AllMaintenanceTasksDocument),
    }),
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.rideOverview,
      queryFn: () => gqlServerFetcherAuthed(RideOverviewDocument),
    }),
    queryClient.prefetchQuery({
      queryKey: garageQueryKeys.rideCount,
      queryFn: () => gqlServerFetcherAuthed(MyRideCountDocument),
    }),
    username
      ? queryClient.prefetchQuery({
          queryKey: garageQueryKeys.profile(username),
          queryFn: () => gqlServerFetcherAuthed(GetRiderProfileDocument, { username }),
        })
      : Promise.resolve(),
  ]);

  const user = session?.user;
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <GarageView
        initialToday={isoDayUtc()}
        account={{
          method: signInMethodFromProvider(user?.app_metadata?.provider),
          email: user?.email ?? meData?.me?.email ?? null,
        }}
      />
    </HydrationBoundary>
  );
}
