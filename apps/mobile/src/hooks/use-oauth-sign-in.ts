import { useMemo } from 'react';
import { AUTH_METHOD, type AuthMethod, type AuthSurface } from '../config/auth';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import {
  classifyOAuthError,
  OAUTH_KIND_OUTCOME,
  OAUTH_OUTCOME,
  OAUTH_STAGE,
  type OAuthMarks,
  type OAuthOutcome,
  type OAuthResult,
  type OAuthStage,
  oauthErrorCode,
  signInWithApple,
  signInWithGoogle,
} from '../lib/oauth';
import { presentOAuthError } from '../lib/oauth-error-alert';
import { triggerImpact } from '../utils/haptics';

type OAuthHandlers = { onApple: () => Promise<void>; onGoogle: () => Promise<void> };

/**
 * The Apple and Google handlers behind `OAuthButtons` on every sign-in surface:
 * login, register, onboarding sign-in and onboarding account (`surface`).
 *
 * One tap is: the light haptic (iOS only, via `triggerImpact`),
 * `auth_oauth_started`, the provider's sign-in, then — when it resolves — exactly
 * one `user_signed_up` (the sign-in just created the account) or `user_signed_in`
 * (a returning rider), with the provider as `auth_method` and the `surface`.
 * Anything thrown (cancel, double tap, no Play services, a real failure) fires
 * neither and goes to `presentOAuthError`, which alerts and reports by kind.
 * Whatever happened, the tap ends with exactly one `auth_oauth_result` (issue 365 T04a,
 * FS-OB2a): outcome, how far it got (`stage`), `duration_ms`, and the error's code
 * only, never its message. No navigation here: the auth listener in the root
 * layout moves the rider on once the session exists.
 *
 * One OAuth sign-in at a time, app-wide (issue 365 T11): a tap on either provider,
 * on any surface, while another is still pending is ignored — no haptic, no
 * events, no second provider call. Riders double-tapped while the sheet was slow
 * to appear and got a second sheet or an "in progress" alert over the first.
 */
export function useOAuthSignIn(surface: AuthSurface): OAuthHandlers {
  return useMemo(
    () => ({
      onApple: () => signIn(signInWithApple, AUTH_METHOD.APPLE, surface),
      onGoogle: () => signIn(signInWithGoogle, AUTH_METHOD.GOOGLE, surface),
    }),
    [surface],
  );
}

type AttemptResult = {
  outcome: OAuthOutcome;
  is_new_user: boolean | null;
  error_code: string | null;
};

// Module-level so it spans every mounted surface (sign-in over the account step).
let oauthInFlight = false;

async function signIn(
  provider: (marks: OAuthMarks) => Promise<OAuthResult>,
  method: AuthMethod,
  surface: AuthSurface,
): Promise<void> {
  if (oauthInFlight) return;
  oauthInFlight = true;
  try {
    await runSignIn(provider, method, surface);
  } finally {
    oauthInFlight = false;
  }
}

async function runSignIn(
  provider: (marks: OAuthMarks) => Promise<OAuthResult>,
  method: AuthMethod,
  surface: AuthSurface,
): Promise<void> {
  triggerImpact();
  trackEvent(AnalyticsEvent.AUTH_OAUTH_STARTED, { provider: method, surface });
  const startedAt = Date.now();
  let stage: OAuthStage = OAUTH_STAGE.SHEET;
  let result: AttemptResult = { outcome: OAUTH_OUTCOME.ERROR, is_new_user: null, error_code: null };
  try {
    const { isNewUser } = await provider({
      onSheetDone: () => {
        stage = OAUTH_STAGE.TOKEN_EXCHANGE;
      },
    });
    // A resolved sign-in got through the exchange, whether or not it reported the mark.
    stage = OAUTH_STAGE.TOKEN_EXCHANGE;
    result = { outcome: OAUTH_OUTCOME.SUCCESS, is_new_user: isNewUser, error_code: null };
    trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
      auth_method: method,
      surface,
    });
  } catch (err) {
    result = {
      outcome: OAUTH_KIND_OUTCOME[classifyOAuthError(err)],
      is_new_user: null,
      error_code: oauthErrorCode(err),
    };
    presentOAuthError(err, method);
  } finally {
    trackEvent(AnalyticsEvent.AUTH_OAUTH_RESULT, {
      provider: method,
      surface,
      outcome: result.outcome,
      stage,
      duration_ms: Date.now() - startedAt,
      is_new_user: result.is_new_user,
      error_code: result.error_code,
    });
  }
}
