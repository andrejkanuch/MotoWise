import { useQuery } from '@tanstack/react-query';
import { fetchRideBundle } from '@/features/ride/fetch-ride-bundle';
import { queryKeys } from '@/lib/query-keys';

/**
 * One ride's encoded route, for the shape on a recap card. Reads the same
 * cache entry as ride detail. `settled` is false while the ride is loading, so
 * a card waits for its shape before it is captured for sharing.
 */
export function useRecapRideRoute(rideId: string | null): {
  route: string | null;
  settled: boolean;
} {
  const query = useQuery({
    queryKey: queryKeys.rides.detail(rideId ?? ''),
    queryFn: () => fetchRideBundle(rideId ?? ''),
    enabled: rideId !== null,
    // A missing shape is not worth an alert: the card shows without it.
    meta: { showErrorAlert: false },
  });
  return {
    route: query.data?.ride.routePolyline ?? null,
    settled: rideId === null || !query.isPending,
  };
}
