/**
 * Shared TanStack Query keys for /garage.
 *
 * Imported by BOTH the server prefetch (page.tsx) and the client useQuery hooks
 * (garage-view.tsx) so the dehydrated server cache always matches the keys the
 * client reads. A literal drift between the two files would silently miss
 * hydration and reintroduce the client-render flash, with no compile error, so
 * the keys live here once.
 */
export const garageQueryKeys = {
  me: ['me'] as const,
  motorcycles: ['garage', 'motorcycles'] as const,
  expenses: (motorcycleId: string | null | undefined) =>
    ['garage', 'expenses', motorcycleId] as const,
  maintenance: ['garage', 'maintenance'] as const,
  rideOverview: ['garage', 'ride-overview'] as const,
  rideCount: ['garage', 'ride-count'] as const,
  profile: (username: string | null | undefined) => ['garage', 'profile', username] as const,
};
