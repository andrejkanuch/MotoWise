import 'server-only';
import type { TripByShareTokenQuery } from '@motovault/graphql';
import { TripByShareTokenDocument } from '@motovault/graphql';
import { TripShareTokenSchema } from '@motovault/types';
import { notFound } from 'next/navigation';
import { gqlServerFetcher, isDefinitiveGraphQLError } from '@/lib/graphql-server';
import { UpstreamError } from '@/lib/upstream-error';

type SharedTrip = NonNullable<TripByShareTokenQuery['tripByShareToken']>;

/**
 * Resolves a trip by its opaque share token via the GraphQL API.
 * Token shape is validated up front via `TripShareTokenSchema` so we
 * never hit the API with obviously malformed input.
 * A malformed, revoked or unknown token is `notFound()`. An API that never
 * answered (timeout, 5xx, network) throws `UpstreamError` instead, so the
 * page can say the trip didn't load rather than call the link dead.
 */
export async function fetchTripByToken(token: string): Promise<SharedTrip> {
  const parsedToken = TripShareTokenSchema.safeParse(token);
  if (!parsedToken.success) notFound();

  let data: TripByShareTokenQuery;
  try {
    data = await gqlServerFetcher(TripByShareTokenDocument, {
      shareToken: parsedToken.data,
    });
  } catch (err) {
    if (isDefinitiveGraphQLError(err)) notFound();
    throw new UpstreamError('shared trip fetch failed');
  }
  if (!data.tripByShareToken) notFound();
  return data.tripByShareToken;
}
