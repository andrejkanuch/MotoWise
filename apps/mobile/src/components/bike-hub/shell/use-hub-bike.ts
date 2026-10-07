import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import type { HubBike } from './use-bike-hub-data';

/**
 * The rider's bikes and one of them by id, from the shared `motorcycles` cache
 * entry — for the hub's sheets and the Notes screen, which get only an id.
 *
 * Deliberately keeps the global alert (no `showErrorAlert: false`): its routes
 * have no error state of their own, so for them the alert IS the error UI. It
 * cannot reach the hub alone — the global handler opts out only when every
 * observer does, so this one vetoes it only while one of those routes is open,
 * and they open from a hub that already has the bike list cached (the alert
 * fires only when nothing is cached).
 */
export function useHubBike(motorcycleId: string | undefined): {
  bike: HubBike | null;
  bikes: HubBike[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bikes = data?.myMotorcycles ?? [];
  return { bike: bikes.find((bike) => bike.id === motorcycleId) ?? null, bikes, isLoading };
}
