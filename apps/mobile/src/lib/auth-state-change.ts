// -------------------------------------------------------------------
// Auth-state-change decision logic (pure)
// -------------------------------------------------------------------
// Supabase `onAuthStateChange` fires for many reasons (INITIAL_SESSION,
// SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT). The handler in
// _layout.tsx must decide, for each event, which side effects to run.
//
// Three independent decisions, each with a subtle correctness constraint:
//
//  1. identify — call `identifyUser` only on a genuine identity CHANGE, not on
//     every TOKEN_REFRESHED (which is wasteful SecureStore + network chatter).
//     First identify after sign-in must still fire (prevUserId starts null).
//     (todo 191)
//
//  2. resetUser — call `resetUser()` + `logoutRevenueCat()` ONLY when we
//     previously had a user in THIS app session. On a genuine first-launch
//     anonymous visitor (cold-start null session, no prior user), calling
//     reset() rotates the PostHog anonymous id and orphans pre-signup events,
//     breaking cross-signup funnels. (Defect 1 — must not regress.)
//
//  3. localCleanup — clear local user data (query cache, sync queue, ride data,
//     notifications, widgets, LAST_USER_KEY) whenever a null session is
//     observed AND a user previously existed. The "previously existed" signal
//     must survive cold starts: a server-revoked session (password reset, ban,
//     refresh-token rotation failure) only surfaces as a null INITIAL_SESSION
//     on the NEXT launch, when the per-mount `prevUserId` ref is null. So we
//     also consult `LAST_USER_KEY` in SecureStore — a persistent signal that a
//     user was signed in on this device. (todo 188)
//
// Extracted as a pure function so the branching is unit-testable without
// mounting the root component.
// -------------------------------------------------------------------

/**
 * Warning reported to Sentry when a null-session cleanup runs while a ride is
 * active or sync ops are still queued. This path fires for BOTH a server-forced
 * sign-out (revocation / token-rotation failure) AND a normal user-initiated
 * sign-out — the decision (`decideAuthStateChange`) keys only on whether a user
 * previously existed, not on the auth event — so the wording stays neutral about
 * the cause. Not a crash: the local cleanup deliberately PRESERVES the sync
 * queue and ride data so they drain once auth is restored.
 * (MOTO-VAULT-REACT-NATIVE-27)
 */
export const SIGNOUT_UNSYNCED_MESSAGE = 'Sign-out with unsynced ride data — preserving sync queue';

/** Sentry `source` tag identifying where the unsynced-sign-out warning fired. */
export const SIGNOUT_UNSYNCED_SOURCE = 'auth-state-change.localCleanup';

export interface AuthStateChangeInputs {
  /** The user id from the new session, or null when there is no session. */
  sessionUserId: string | null;
  /** Last user id identified in THIS app session (per-mount ref). Null at launch. */
  prevUserId: string | null;
  /** Whether `LAST_USER_KEY` exists in SecureStore — survives cold starts. */
  hasPersistedUser: boolean;
}

export interface AuthStateChangeDecision {
  /** Run `identifyUser(sessionUserId)` + `loginRevenueCat(sessionUserId)`. */
  shouldIdentify: boolean;
  /** Run `resetUser()` + `logoutRevenueCat()` (PostHog id rotation / RC logout). */
  shouldResetUser: boolean;
  /** Run local-data cleanup (query cache, sync queue, notifications, widgets…). */
  shouldClearLocalData: boolean;
}

/**
 * Decide which side effects an auth-state-change event should trigger.
 *
 * Pure: no IO, no refs mutated. The caller is responsible for updating
 * `prevUserId` afterward (always set it to `sessionUserId`).
 */
export function decideAuthStateChange({
  sessionUserId,
  prevUserId,
  hasPersistedUser,
}: AuthStateChangeInputs): AuthStateChangeDecision {
  if (sessionUserId) {
    // Session present: identify only on a genuine identity change (todo 191).
    return {
      shouldIdentify: prevUserId !== sessionUserId,
      shouldResetUser: false,
      shouldClearLocalData: false,
    };
  }

  // Null session. Did a user previously exist? In-session ref OR the
  // cold-start-surviving SecureStore signal (todo 188).
  const hadUser = prevUserId !== null || hasPersistedUser;

  return {
    // resetUser stays gated on the per-mount ref ONLY: on a true first-launch
    // anonymous visitor (no prevUserId) we must NOT rotate the anonymous id,
    // even though no LAST_USER_KEY exists either. Gating on the ref preserves
    // Defect 1 exactly as before.
    shouldResetUser: prevUserId !== null,
    // Local cleanup runs whenever a user previously existed by EITHER signal,
    // so a server-revoked session surviving a cold start still clears data.
    shouldClearLocalData: hadUser,
    shouldIdentify: false,
  };
}
