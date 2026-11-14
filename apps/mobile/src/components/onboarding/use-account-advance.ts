import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { meOptions } from '../../lib/query-options';

/**
 * How long the step waits for the server onboarding state after the session lands
 * before it moves on anyway (issue 365 T12, FS-OB2b). `me` retries with backoff, so
 * without a limit a slow or unreachable API held riders on "Creating your account…"
 * for up to 141 s. Moving on is safe: the root NavigationGate still reads `me` and
 * routes an already-onboarded account to the tabs once it arrives.
 */
export const ACCOUNT_ME_WAIT_MS = 8_000;

/** `outcome` on `auth_post_signin_wait` (issue 365 T04a, FS-OB2b). */
const POST_SIGNIN_WAIT_OUTCOME = {
  ADVANCED: 'advanced',
  ALREADY_ONBOARDED: 'already_onboarded',
  ME_ERROR: 'me_error',
  TIMEOUT: 'timeout',
} as const;

/**
 * The onboarding account step's move once a session exists.
 *
 * A session appearing on the account step means the account was created / signed
 * in — advance. _layout keeps the onboarding stack mounted mid-sign-in, and
 * already calls loginRevenueCat(uuid) + identifyUser, so the anonymous purchase
 * aliases automatically.
 *
 * BUT: the step also accepts returning users (Apple/Google don't separate sign-up
 * from sign-in, and the "Already have an account?" link lands there on OAuth). For
 * an account that has ALREADY completed onboarding, advancing into the
 * notifications step would flash it for ~1-2s before the root gate detects
 * onboardingCompleted and redirects to the app — the user can't actually act on
 * it. So we wait for the server onboarding state and only continue the flow for
 * accounts that still need it; already-onboarded accounts fall through to the
 * NavigationGate's (tabs) redirect with no flash.
 *
 * The wait is bounded by ACCOUNT_ME_WAIT_MS: if `me` is still loading then, the
 * flow advances (`outcome: 'timeout'`).
 *
 * The decision fires `auth_post_signin_wait` once: how long it waited from the
 * session landing (`wait_ms`) and which way it went (`outcome`).
 */
export function useAccountAdvance(hasSession: boolean, goNext: () => void): void {
  const advancedRef = useRef(false);
  const sessionSeenAtRef = useRef<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Server onboarding state for the just-authenticated account. Shares the root
  // NavigationGate's cache key, so this is usually a cache hit (no extra fetch).
  const meQuery = useQuery({ ...meOptions(), enabled: hasSession });

  // The limit runs from the session landing until the step decides.
  useEffect(() => {
    if (!hasSession) return;
    const timer = setTimeout(() => setTimedOut(true), ACCOUNT_ME_WAIT_MS);
    return () => clearTimeout(timer);
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession || advancedRef.current) return;
    sessionSeenAtRef.current ??= Date.now();
    // Wait for the server onboarding state to settle (unless it errored — then we
    // can't know, so proceed with the flow rather than strand the user here), but
    // never longer than ACCOUNT_ME_WAIT_MS.
    const stillLoading = meQuery.isLoading && !meQuery.isError;
    if (stillLoading && !timedOut) return;

    const alreadyOnboarded =
      (meQuery.data?.me?.preferences as { onboardingCompleted?: boolean } | null | undefined)
        ?.onboardingCompleted === true;

    advancedRef.current = true;
    // `account_created` used to fire here. Retired 2026-08-24: emitted from ONE
    // onboarding screen, it measured screen traversal rather than signup (154
    // events against 320 real signups) and became the broken denominator under
    // every activation tile. Signup is now counted server-side off the
    // public.users insert — see migration 00174 and SignupEventsService. The
    // client-side `user_signed_up` stays because it carries `auth_method` at the
    // moment of the auth call; the constant is kept so historical events still
    // resolve in PostHog.
    trackEvent(AnalyticsEvent.AUTH_POST_SIGNIN_WAIT, {
      wait_ms: Date.now() - sessionSeenAtRef.current,
      outcome: stillLoading
        ? POST_SIGNIN_WAIT_OUTCOME.TIMEOUT
        : waitOutcome(meQuery.isError, alreadyOnboarded),
    });

    // Already-onboarded → let the root gate redirect to (tabs); don't push the
    // notifications step. New accounts → continue the onboarding flow.
    if (!alreadyOnboarded) goNext();
  }, [hasSession, goNext, meQuery.isLoading, meQuery.isError, meQuery.data, timedOut]);
}

// The outcome names the way the step went. A failed refetch over cached data that
// already says "onboarded" still takes the no-advance path, so it reports that.
function waitOutcome(meError: boolean, alreadyOnboarded: boolean) {
  if (alreadyOnboarded) return POST_SIGNIN_WAIT_OUTCOME.ALREADY_ONBOARDED;
  return meError ? POST_SIGNIN_WAIT_OUTCOME.ME_ERROR : POST_SIGNIN_WAIT_OUTCOME.ADVANCED;
}
