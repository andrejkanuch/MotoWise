'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { humanizeAuthError, type SupabaseAuthError } from '@/lib/auth-errors';
import type { OAuthProvider } from './auth-ui';

/**
 * How long "Redirecting…" may hold the OAuth buttons before the page gives
 * up and hands control back. The provider redirect normally leaves the page
 * within a second; past this the navigation was blocked or never started.
 */
export const OAUTH_REDIRECT_TIMEOUT_MS = 15_000;

/** Recovery copy when the redirect never happened (logbook voice, names the way out). */
export const OAUTH_STUCK_MESSAGE =
  'The sign-in page did not open. Allow redirects for this site or try again; you can also sign in with your email.';

type OAuthResult = { error: SupabaseAuthError | null };

/**
 * Owns the "Redirecting…" state of the OAuth buttons so it can never stick:
 * - an error from `signInWithOAuth` (popup blocked, provider misconfigured,
 *   offline) resets the buttons and reports a rider-facing message;
 * - a redirect that never navigates is released after
 *   {@link OAUTH_REDIRECT_TIMEOUT_MS} with {@link OAUTH_STUCK_MESSAGE};
 * - coming back from the provider through the back-forward cache restores
 *   the page mid-redirect, so `pageshow` with `persisted` resets it too.
 *
 * `onFail` receives the message to show in the page's error region.
 */
export function useOAuthRedirect(onFail: (message: string) => void) {
  const [provider, setProvider] = useState<OAuthProvider | null>(null);
  const timer = useRef<number | null>(null);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setProvider(null);
  }, [clearTimer]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      clearTimer();
    };
  }, [reset, clearTimer]);

  const start = useCallback(
    async (next: OAuthProvider, redirect: () => Promise<OAuthResult>) => {
      if (timer.current !== null) return;
      setProvider(next);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setProvider(null);
        onFailRef.current(OAUTH_STUCK_MESSAGE);
      }, OAUTH_REDIRECT_TIMEOUT_MS);
      const { error } = await redirect();
      if (error) {
        reset();
        onFailRef.current(humanizeAuthError(error).message);
      }
    },
    [reset],
  );

  return { provider, start };
}
