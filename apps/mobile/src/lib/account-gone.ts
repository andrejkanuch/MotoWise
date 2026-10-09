import { useAuthStore } from '../stores/auth.store';
import { addBreadcrumb, captureException } from './analytics';
import { GRAPHQL_ERROR_CODE } from './graphql-error-classification';
import { hasGraphQLCode } from './graphql-errors';
import { supabase } from './supabase';

const ACCOUNT_GONE_SOURCE = 'accountGone.signOut';

/** In-flight sign-outs, one per gone account (single-flight per account). */
const signingOut = new Map<string, Promise<void>>();

/**
 * True when the API answered the `me` query with NOT_FOUND: the session's user
 * has no `users` row any more (hard-deleted, or removed by an operator) while the
 * phone still holds a valid token. The API only says NOT_FOUND for a genuinely
 * missing row — a database fault is INTERNAL_SERVER_ERROR (UsersService.findById).
 */
export function isAccountGoneError(error: unknown): boolean {
  return hasGraphQLCode(error, GRAPHQL_ERROR_CODE.NOT_FOUND);
}

/**
 * The user whose token the next request will carry. Synchronous: the auth store's
 * session is set in the same auth callback that resets the GraphQL token cache, so
 * it tracks the token gqlFetcher sends, and reading it adds no keychain read and
 * no wait outside the request's own deadline.
 */
export function getRequestSessionUserId(): string | null {
  return useAuthStore.getState().session?.user?.id ?? null;
}

/** The signed-in user id from the Supabase client, or null. Never throws. */
async function getSessionUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Ends a session whose account no longer exists. Local-only: the server has
 * nothing left to revoke. Clearing the session flips the root layout's guards,
 * which routes to the signed-out stack, and the auth listener wipes local data.
 *
 * `requestUserId` is the user whose `me` request answered NOT_FOUND. A slow
 * request can come back after another account signed in; only the session that
 * sent it is ended, never a replacement. Single-flight per account — every
 * screen's `me` query can fail at once — so a stale check for one account never
 * swallows a genuine NOT_FOUND for another.
 */
export function signOutGoneAccount(requestUserId: string | null): Promise<void> {
  if (!requestUserId) return Promise.resolve();
  const inFlight = signingOut.get(requestUserId);
  if (inFlight) return inFlight;
  const run = (async () => {
    if ((await getSessionUserId()) !== requestUserId) return;
    addBreadcrumb('me returned NOT_FOUND; signing out locally', ACCOUNT_GONE_SOURCE);
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) captureException(error, { source: ACCOUNT_GONE_SOURCE });
  })()
    .catch((err) => captureException(err, { source: ACCOUNT_GONE_SOURCE }))
    .finally(() => {
      signingOut.delete(requestUserId);
    });
  signingOut.set(requestUserId, run);
  return run;
}
