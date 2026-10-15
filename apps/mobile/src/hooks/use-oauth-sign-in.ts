import { AUTH_METHOD, type AuthMethod } from '../config/auth';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { type OAuthResult, signInWithApple, signInWithGoogle } from '../lib/oauth';
import { presentOAuthError } from '../lib/oauth-error-alert';
import { triggerImpact } from '../utils/haptics';

/**
 * The Apple and Google handlers behind `OAuthButtons` on every sign-in surface:
 * login, register, onboarding sign-in and onboarding account.
 *
 * One tap is: the light haptic (iOS only, via `triggerImpact`), the provider's
 * sign-in, then exactly one event — `user_signed_up` when the sign-in just
 * created the account, `user_signed_in` for a returning rider — with the
 * provider as `auth_method`. Anything thrown (cancel, double tap, no Play
 * services, a real failure) fires no event and goes to `presentOAuthError`,
 * which alerts and reports by kind. No navigation here: the auth listener in
 * the root layout moves the rider on once the session exists.
 */
export function useOAuthSignIn(): { onApple: () => Promise<void>; onGoogle: () => Promise<void> } {
  return {
    onApple: () => signIn(signInWithApple, AUTH_METHOD.APPLE),
    onGoogle: () => signIn(signInWithGoogle, AUTH_METHOD.GOOGLE),
  };
}

async function signIn(provider: () => Promise<OAuthResult>, method: AuthMethod): Promise<void> {
  triggerImpact();
  try {
    const { isNewUser } = await provider();
    trackEvent(isNewUser ? AnalyticsEvent.USER_SIGNED_UP : AnalyticsEvent.USER_SIGNED_IN, {
      auth_method: method,
    });
  } catch (err) {
    presentOAuthError(err);
  }
}
