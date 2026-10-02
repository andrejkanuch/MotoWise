import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import type { HubBike } from './use-bike-hub-data';

/**
 * The rider's bikes and one of them by id, from the shared `motorcycles` cache
 * entry — for the hub's sheets and the Notes screen, which get only an id.
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
