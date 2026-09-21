import type { AppStateStatus } from 'react-native';

/** Foreground app state — a real user is looking at the screen. */
export const APP_STATE_ACTIVE: AppStateStatus = 'active';

/**
 * How long to wait for Supabase to hydrate the stored session before declaring
 * hydration UNRESOLVED.
 *
 * This budget must cover a chunked expo-secure-store/Keychain read AND one
 * network token refresh: `GoTrueClient.__loadSession` awaits `_callRefreshToken`
 * unconditionally whenever the stored access token is within EXPIRY_MARGIN_MS
 * (90s) of expiry, which it is on nearly every cold start because the
 * auto-refresh ticker cannot run while the process is dead. 8000ms lost that
 * race on low-power-mode devices. `SPLASH_FAILSAFE_MS` below is the anti-wedge
 * guarantee (it hides the splash directly), so this timer does not have to
 * double as the splash backstop and can afford the real budget.
 */
export const AUTH_HYDRATION_TIMEOUT_MS = 15000;

/** Extra wait before the restoring screen offers a manual "Sign in instead". */
export const AUTH_HYDRATION_ESCAPE_MS = 5000;

/**
 * Hard cap in `_layout.tsx` — if hydration or the `me` query ever hangs, the
 * native splash is hidden anyway so the app can never wedge behind it.
 *
 * Derived, not a second independent magic number, because the ordering is load
 * bearing: the hydration timer is what puts a real surface (SessionRestoring) on
 * screen, so hiding the splash BEFORE it has fired would reveal an empty root
 * view instead of either the splash or a screen. Raising
 * AUTH_HYDRATION_TIMEOUT_MS past a hardcoded 10000ms failsafe is exactly how
 * that gap would have opened. `splashFailsafeOutlastsHydration` asserts it.
 */
export const SPLASH_FAILSAFE_MS = AUTH_HYDRATION_TIMEOUT_MS + 3000;

/** The invariant SPLASH_FAILSAFE_MS is derived to satisfy. Exported for its test. */
export function splashFailsafeOutlastsHydration(): boolean {
  return SPLASH_FAILSAFE_MS > AUTH_HYDRATION_TIMEOUT_MS;
}

/**
 * Breadcrumb text for the hydration timeout.
 *
 * Deliberately a breadcrumb, not a captured message: Sentry has no non-issue
 * message destination, so `captureMessage` filed this latency signal as an
 * unresolved issue. Its value is its RATE against launches, which lives in
 * PostHog. (MOTO-VAULT-REACT-NATIVE-33)
 */
export const AUTH_HYDRATION_TIMEOUT_MESSAGE = 'Auth hydration timeout — forcing app ready';

/** Breadcrumb category identifying where the timeout fired. */
export const AUTH_HYDRATION_TIMEOUT_SOURCE = 'RootLayout.authTimeout';

/**
 * Auth hydration has exactly three states, and conflating the last two is the
 * defect this vocabulary exists to prevent:
 *
 *  PENDING     — hydration has not answered. Hold the splash.
 *  RESOLVED    — hydration answered. `session === null` here is AUTHORITATIVE
 *                and means signed out.
 *  UNRESOLVED  — we gave up waiting. `session === null` here means UNKNOWN, NOT
 *                signed out. Rendering (auth) on this state showed a login
 *                screen to riders who were signed in the whole time.
 *
 * supabase-js exposes no way to ask "has hydration finished?" other than
 * `INITIAL_SESSION` (guaranteed exactly once per subscriber, including `null`
 * for no stored session and `null` from the hydration-error catch path), and no
 * way at all to ask "has hydration NOT finished yet?" — `initializePromise` is
 * `protected`. So the timer supplies the second answer and this third state
 * records it honestly instead of guessing "signed out".
 */
export const AUTH_HYDRATION = {
  PENDING: 'pending',
  RESOLVED: 'resolved',
  UNRESOLVED: 'unresolved',
} as const;

export type AuthHydration = (typeof AUTH_HYDRATION)[keyof typeof AUTH_HYDRATION];

/** The auth facts the root navigation gate routes on. */
export interface AuthGateInput {
  isSignedIn: boolean;
  isAnonOnboarding: boolean;
  hydration: AuthHydration;
}

/**
 * Whether the router may render the (auth)/login group.
 *
 * ONLY on a RESOLVED null session. An UNRESOLVED null session is an unanswered
 * question, and answering it with a login screen is the bug.
 */
export function shouldRenderAuthGroup({
  isSignedIn,
  isAnonOnboarding,
  hydration,
}: AuthGateInput): boolean {
  if (isSignedIn || isAnonOnboarding) return false;
  return hydration === AUTH_HYDRATION.RESOLVED;
}

/**
 * Whether to render the bounded "restoring your session" screen instead of
 * either the splash or the login screen.
 */
export function shouldRenderRestoring({
  isSignedIn,
  isAnonOnboarding,
  hydration,
}: AuthGateInput): boolean {
  if (isSignedIn || isAnonOnboarding) return false;
  return hydration === AUTH_HYDRATION.UNRESOLVED;
}

/**
 * Decide whether the auth-hydration safety timeout is worth recording at all.
 *
 * The timeout always stops holding the splash, but it is only a signal when a
 * real user is waiting on a foregrounded app. On background launches (widget
 * sync, location updates, silent pushes) iOS throttles JS, so hydration cannot
 * resolve in wall-clock time and the timer fires harmlessly. Recording that is
 * pure noise. (Sentry MOTO-VAULT-REACT-NATIVE-W)
 */
export function shouldReportHydrationTimeout(
  isLoading: boolean,
  appState: AppStateStatus,
): boolean {
  return isLoading && appState === APP_STATE_ACTIVE;
}
