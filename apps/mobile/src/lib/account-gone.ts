import { addBreadcrumb, captureException } from './analytics';
import { GRAPHQL_ERROR_CODE } from './graphql-error-classification';
import { hasGraphQLCode } from './graphql-errors';
import { supabase } from './supabase';

const ACCOUNT_GONE_SOURCE = 'accountGone.signOut';

let signingOut: Promise<void> | null = null;

/**
 * True when the API answered the `me` query with NOT_FOUND: the session's user
 * has no `users` row any more (hard-deleted, or removed by an operator) while the
 * phone still holds a valid token. The API only says NOT_FOUND for a genuinely
 * missing row — a database fault is INTERNAL_SERVER_ERROR (UsersService.findById).
 */
export function isAccountGoneError(error: unknown): boolean {
  return hasGraphQLCode(error, GRAPHQL_ERROR_CODE.NOT_FOUND);
}

/** The signed-in user id, or null. Never throws. */
export async function getSessionUserId(): Promise<string | null> {
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
 * sent it is ended, never a replacement. Single-flight — every screen's `me`
 * query can fail at once.
 */
export function signOutGoneAccount(requestUserId: string | null): Promise<void> {
  if (!requestUserId) return Promise.resolve();
  if (!signingOut) {
    signingOut = (async () => {
      if ((await getSessionUserId()) !== requestUserId) return;
      addBreadcrumb('me returned NOT_FOUND; signing out locally', ACCOUNT_GONE_SOURCE);
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) captureException(error, { source: ACCOUNT_GONE_SOURCE });
    })()
      .catch((err) => captureException(err, { source: ACCOUNT_GONE_SOURCE }))
      .finally(() => {
        signingOut = null;
      });
  }
  return signingOut;
}
