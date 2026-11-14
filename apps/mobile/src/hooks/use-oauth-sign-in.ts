import { useEffect, useMemo, useRef, useState } from 'react';
import { AUTH_METHOD, type AuthMethod, type AuthSurface } from '../config/auth';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import {
  classifyOAuthError,
  OAUTH_ERROR_KIND,
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

type OAuthHandlers = {
  onApple: () => Promise<void>;
  onGoogle: () => Promise<void>;
  /**
   * The provider whose sign-in THIS surface started and is still waiting on, from
   * the tap until it settles; `null` when idle (issue 365 T12). `OAuthButtons` takes
   * it as `busyProvider`: both buttons disabled, a spinner on the tapped one.
   */
  busyProvider: AuthMethod | null;
};

/**
 * The Apple and Google handlers behind `OAuthButtons` on every sign-in surface:
 * login, register, onboarding sign-in and onboarding account (`surface`).
 *
 * One tap is: the light haptic (iOS only, via `triggerImpact`),
 * `auth_oauth_started`, the provider's sign-in, then — when it resolves — exactly
 * one `user_signed_up` (the sign-in just created the account) or `user_signed_in`
 * (a returning rider), with the provider as `auth_method` and the `surface`.
 * Anything thrown (cancel, double tap, no Play services, a real failure) fires
 * neither. A cancel (`expected`) ends there, silently: the rider closed the sheet
 * on purpose and is back where they tapped (issue 365 T12, FS-OB2c; it used to
 * alert "Something went wrong"). Everything else goes to `presentOAuthError`,
 * which alerts and reports by kind.
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
  const [busyProvider, setBusyProvider] = useState<AuthMethod | null>(null);
  // The sign-in can settle after the screen is gone (the session landed and the
  // flow moved on); no state update then.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handlers = useMemo(() => {
    const run = async (
      provider: (marks: OAuthMarks) => Promise<OAuthResult>,
      method: AuthMethod,
    ): Promise<void> => {
      // A tap ignored by the in-flight guard leaves the pending one's busy state alone.
      // A sign-in that started always clears it, even if something in it threw, so
      // the buttons never stay disabled.
      let started = false;
      try {
        await signIn(provider, method, surface, () => {
          started = true;
          setBusyProvider(method);
        });
      } finally {
        if (started && mountedRef.current) setBusyProvider(null);
      }
    };
    return {
      onApple: () => run(signInWithApple, AUTH_METHOD.APPLE),
      onGoogle: () => run(signInWithGoogle, AUTH_METHOD.GOOGLE),
    };
  }, [surface]);

  return { ...handlers, busyProvider };
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
  onStart: () => void,
): Promise<void> {
  if (oauthInFlight) return;
  oauthInFlight = true;
  try {
    onStart();
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
    const kind = classifyOAuthError(err);
    result = {
      outcome: OAUTH_KIND_OUTCOME[kind],
      is_new_user: null,
      error_code: oauthErrorCode(err),
    };
    if (kind !== OAUTH_ERROR_KIND.expected) presentOAuthError(err, method);
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
