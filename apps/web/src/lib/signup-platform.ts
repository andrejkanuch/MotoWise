import { signUpConsentOptions } from '@/lib/signup-consent';

/**
 * Sign-up metadata key that records where the account was created. MUST stay
 * "signup_platform": migration 00188 returns it to the signup-event sweep, which
 * sends it on the server-side `signup_completed` event. Without it PostHog could
 * not split signups by platform, so it could not measure how many web signups
 * open the app.
 */
export const SIGNUP_PLATFORM_METADATA_KEY = 'signup_platform';
export const WEB_SIGNUP_PLATFORM = 'web';

/** Where a new web account lands: the hand-off to the app, not the web garage. */
export const WELCOME_PATH = '/welcome';

/**
 * A new Google/Apple account reaches the OAuth callback seconds after Supabase
 * creates it. Five minutes is wide enough for a slow consent screen and much
 * shorter than the sweep's 10-minute wait, so the tag is in place before the
 * event is sent.
 */
const NEW_OAUTH_ACCOUNT_WINDOW_MS = 5 * 60 * 1000;

/** `options` for a web `supabase.auth.signUp`: the platform tag plus the consent decision. */
export function webSignUpOptions(consent: boolean | null): { data: Record<string, unknown> } {
  return {
    data: {
      ...signUpConsentOptions(consent)?.data,
      [SIGNUP_PLATFORM_METADATA_KEY]: WEB_SIGNUP_PLATFORM,
    },
  };
}

type CallbackUser = {
  created_at?: string;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * True when the web OAuth callback just created this account, so it must be
 * tagged as a web signup. The OAuth flow carries no sign-up metadata, so the
 * callback writes the tag. The app signs in with `signInWithIdToken` and never
 * reaches this callback. Email accounts are skipped: a web email sign-up
 * already sends the tag, and an app sign-up can confirm its email through here.
 */
export function isNewWebOAuthAccount(user: CallbackUser, now = Date.now()): boolean {
  if ((user.app_metadata?.provider ?? 'email') === 'email') return false;
  if (user.user_metadata?.[SIGNUP_PLATFORM_METADATA_KEY] != null) return false;
  const created = user.created_at ? Date.parse(user.created_at) : Number.NaN;
  return Number.isFinite(created) && now - created <= NEW_OAUTH_ACCOUNT_WINDOW_MS;
}
