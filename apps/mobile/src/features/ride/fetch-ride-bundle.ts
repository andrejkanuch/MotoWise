// Ride detail loads the ride as its owner first, then as a public ride. Only a "this
// isn't yours" answer may fall back to the public lookup: GetRide reports a ride that
// isn't yours as NOT_FOUND (the owner check is part of the lookup) and a signed-out
// viewer of a shared link as UNAUTHENTICATED. Anything else — offline, a 5xx — is
// rethrown, because the public lookup would replace it with a misleading "Ride not
// found" (MOTO-VAULT-REACT-NATIVE-1M).
import { GetPublicRideDocument, GetRideDocument } from '@motovault/graphql';
import { gqlFetcher } from '../../lib/graphql-client';
import { GRAPHQL_ERROR_CODE } from '../../lib/graphql-error-classification';
import { hasGraphQLCode } from '../../lib/graphql-errors';

export const RIDE_VIEWER = { owner: 'owner', public: 'public' } as const;

const PUBLIC_FALLBACK_CODES = [
  GRAPHQL_ERROR_CODE.NOT_FOUND,
  GRAPHQL_ERROR_CODE.UNAUTHENTICATED,
  GRAPHQL_ERROR_CODE.FORBIDDEN,
] as const;

export async function fetchRideBundle(id: string) {
  try {
    const r = await gqlFetcher(GetRideDocument, { id });
    return { viewer: RIDE_VIEWER.owner, ride: r.ride };
  } catch (err) {
    if (!PUBLIC_FALLBACK_CODES.some((code) => hasGraphQLCode(err, code))) throw err;
    const r = await gqlFetcher(GetPublicRideDocument, { id });
    return { viewer: RIDE_VIEWER.public, ride: r.getPublicRide };
  }
}
