import { TripByShareTokenDocument, type TripByShareTokenQuery } from '@motovault/graphql';
import { TripShareTokenSchema } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { gqlFetcher } from '../lib/graphql-client';

export type TrampolineState =
  | { status: 'validating' }
  | { status: 'fetching' }
  | { status: 'failed' }
  | {
      status: 'resolved';
      data: NonNullable<TripByShareTokenQuery['tripByShareToken']>;
    };

/**
 * Resolves a raw (untrusted) share token string into a trip preview via the
 * public `tripByShareToken` GraphQL query. The token is validated against the
 * branded `TripShareTokenSchema` before the network call — malformed tokens
 * never hit the wire.
 */
export function useTripShareTokenResolver(rawToken: string | undefined): TrampolineState {
  const parsed = useMemo(() => {
    if (!rawToken) return null;
    const result = TripShareTokenSchema.safeParse(rawToken);
    return result.success ? result.data : null;
  }, [rawToken]);

  const query = useQuery<TripByShareTokenQuery>({
    enabled: parsed !== null,
    queryKey: ['trip-by-share-token', parsed],
    queryFn: () => gqlFetcher(TripByShareTokenDocument, { shareToken: parsed as string }),
    retry: false,
    staleTime: 0,
  });

  if (rawToken === undefined) return { status: 'validating' };
  if (parsed === null) return { status: 'failed' };
  if (query.isLoading) return { status: 'fetching' };
  if (query.isError || !query.data?.tripByShareToken) {
    return { status: 'failed' };
  }
  return { status: 'resolved', data: query.data.tripByShareToken };
}
