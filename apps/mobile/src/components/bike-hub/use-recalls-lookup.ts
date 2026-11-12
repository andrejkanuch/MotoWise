import { MotorcycleRecallsDocument, type MotorcycleRecallsQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { canCheckRecalls } from '../../lib/bike-hub/recall-eligibility';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { QUERY_META } from '../../lib/query-meta';
import { useHubBike } from './shell/use-hub-bike';

/** 1 hour client-side (the server caches NHTSA answers for 24h). */
const RECALLS_SCREEN_STALE_MS = 60 * 60 * 1000;

export interface RecallsLookup {
  result: MotorcycleRecallsQuery['motorcycleRecalls'] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** The bike has no model/year and no VIN: nothing was asked, the rider fills the bike in. */
  needsDetails: boolean;
}

/**
 * The Recalls screen's lookup for one bike. A bike without model/year and
 * without a VIN cannot be looked up (the API answers 422 UNPROCESSABLE_ENTITY),
 * so the request is skipped and `needsDetails` is set instead (Sentry
 * MOTO-VAULT-REACT-NATIVE-42). When the bike list is unavailable the server
 * decides.
 */
export function useRecallsLookup(motorcycleId: string | undefined): RecallsLookup {
  const { bike, isLoading: bikeLoading } = useHubBike(motorcycleId);
  const needsDetails = bike !== null && !canCheckRecalls(bike);
  const bikeKnownOrUnavailable = bike !== null || !bikeLoading;

  const query = useQuery({
    queryKey: queryKeys.motorcycleRecalls.byMotorcycle(motorcycleId ?? ''),
    queryFn: () => gqlFetcher(MotorcycleRecallsDocument, { motorcycleId: motorcycleId ?? '' }),
    enabled: !!motorcycleId && !needsDetails && bikeKnownOrUnavailable,
    staleTime: RECALLS_SCREEN_STALE_MS,
    // Renders its own error banner. The bike hub's Overview observes this key
    // with the same opt-out; the global handler needs every observer to agree.
    meta: QUERY_META.OWN_ERROR_UI,
  });

  return {
    result: needsDetails ? undefined : query.data?.motorcycleRecalls,
    isLoading: query.isLoading || (bike === null && bikeLoading),
    error: needsDetails ? null : query.error,
    needsDetails,
  };
}
