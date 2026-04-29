import 'server-only';
import type { TripByShareTokenQuery } from '@motovault/graphql';
import { TripByShareTokenDocument } from '@motovault/graphql';
import { TripShareTokenSchema } from '@motovault/types';
import { notFound } from 'next/navigation';
import { gqlServerFetcher } from '@/lib/graphql-server';

type SharedTrip = NonNullable<TripByShareTokenQuery['tripByShareToken']>;

/**
 * Resolves a trip by its opaque share token via the GraphQL API.
 * Token shape is validated up front via `TripShareTokenSchema` so we
 * never hit the API with obviously malformed input.
 * Every failure mode (invalid token, revoked, API error) is treated
 * the same way — `notFound()`.
 */
export async function fetchTripByToken(token: string): Promise<SharedTrip> {
  const parsedToken = TripShareTokenSchema.safeParse(token);
  if (!parsedToken.success) notFound();

  try {
    const data = await gqlServerFetcher(TripByShareTokenDocument, {
      shareToken: parsedToken.data,
    });
    if (!data.tripByShareToken) notFound();
    return data.tripByShareToken;
  } catch {
    notFound();
  }
}
