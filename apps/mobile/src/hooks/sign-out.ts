import { releaseSheetDraftsForSignOut } from '../components/bike-hub/notes/unattached-note-photos';
import { unregisterPushTokenForSignOut } from '../lib/push-token';
import { safeSignOut } from '../lib/supabase';

/**
 * User-initiated sign-out — Log out, and both account-deletion flows (profile
 * hook and Privacy screen). The account-scoped cleanup needs the session, so it
 * runs BEFORE sign-out; the auth listener only runs after it. Each step is
 * capped and never throws, so sign-out always completes.
 */
export async function signOutUser(): Promise<void> {
  await Promise.all([releaseSheetDraftsForSignOut(), unregisterPushTokenForSignOut()]);
  await safeSignOut();
}
