import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { DEFAULT_KM_PER_LITER, DEFAULT_TANK_LITERS } from '../utils/fuel-range';

/**
 * Returns the user's primary bike ID and default fuel data.
 * The server computes actual km/L from fuel logs — this hook provides
 * the bikeId so the server can do that lookup.
 */
export function usePrimaryBikeFuelData() {
  const { data: bikeId } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    select: (d) => {
      const bikes = d?.myMotorcycles ?? [];
      const primary = bikes.find((b) => b.isPrimary) ?? bikes[0];
      return primary?.id;
    },
  });

  return {
    bikeId,
    tankLiters: DEFAULT_TANK_LITERS,
    kmPerLiter: DEFAULT_KM_PER_LITER,
  };
}
