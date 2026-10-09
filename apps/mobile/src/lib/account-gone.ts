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

/**
 * Ends a session whose account no longer exists. Local-only: the server has
 * nothing left to revoke. Clearing the session flips the root layout's guards,
 * which routes to the signed-out stack, and the auth listener wipes local data.
 * Single-flight — every screen's `me` query can fail at once.
 */
export function signOutGoneAccount(): Promise<void> {
  if (!signingOut) {
    addBreadcrumb('me returned NOT_FOUND; signing out locally', ACCOUNT_GONE_SOURCE);
    signingOut = supabase.auth
      .signOut({ scope: 'local' })
      .then(({ error }) => {
        if (error) captureException(error, { source: ACCOUNT_GONE_SOURCE });
      })
      .catch((err) => captureException(err, { source: ACCOUNT_GONE_SOURCE }))
      .finally(() => {
        signingOut = null;
      });
  }
  return signingOut;
}
