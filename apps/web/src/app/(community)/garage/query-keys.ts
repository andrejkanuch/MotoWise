/**
 * Shared TanStack Query keys for the garage dashboard.
 *
 * Imported by BOTH the server prefetch (page.tsx) and the client useQuery hooks
 * (garage-dashboard.tsx) so the dehydrated server cache always matches the keys
 * the client reads. A literal drift between the two files would silently miss
 * hydration and reintroduce the client-render flash this refactor removed, with
 * no compile error — so the keys live here once.
 */
export const garageQueryKeys = {
  me: ['me'] as const,
  motorcycles: ['garage', 'motorcycles'] as const,
  // Prefix used for cache invalidation (matches all per-bike expense queries).
  expensesBase: ['garage', 'expenses'] as const,
  expenses: (motorcycleId: string | null | undefined) =>
    ['garage', 'expenses', motorcycleId] as const,
  maintenance: ['garage', 'maintenance'] as const,
  trips: ['garage', 'trips'] as const,
  profile: (username: string | null | undefined) => ['garage', 'profile', username] as const,
};
