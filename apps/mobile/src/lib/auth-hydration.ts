import type { AppStateStatus } from 'react-native';

/** Foreground app state — a real user is looking at the screen. */
export const APP_STATE_ACTIVE: AppStateStatus = 'active';

/** Milliseconds to wait for auth hydration before force-unblocking the splash. */
export const AUTH_HYDRATION_TIMEOUT_MS = 8000;

/** Error reported to Sentry when hydration exceeds the safety timeout in foreground. */
export const AUTH_HYDRATION_TIMEOUT_MESSAGE = 'Auth hydration timeout — forcing app ready';

/** Sentry `source` tag identifying where the timeout fired. */
export const AUTH_HYDRATION_TIMEOUT_SOURCE = 'RootLayout.authTimeout';

/**
 * Decide whether the auth-hydration safety timeout should be reported to Sentry.
 *
 * The timeout always unblocks the splash, but it should only be reported as an
 * error when a real user is waiting on a foregrounded app. On background
 * launches (widget sync, location updates, silent pushes) iOS throttles JS, so
 * `supabase.auth.getSession()` cannot resolve in wall-clock time and the timer
 * fires harmlessly. Reporting that is pure noise. (Sentry MOTO-VAULT-REACT-NATIVE-W)
 */
export function shouldReportHydrationTimeout(
  isLoading: boolean,
  appState: AppStateStatus,
): boolean {
  return isLoading && appState === APP_STATE_ACTIVE;
}
