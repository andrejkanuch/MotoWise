import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import PostHog from 'posthog-react-native';

// -------------------------------------------------------------------
// Analytics & Crash Reporting Wrapper
// -------------------------------------------------------------------
// Wraps Sentry (crash reporting) and PostHog (product analytics) with
// a privacy-respecting layer. Both SDKs are disabled by default if no
// DSN / API key is configured, and they respect the user's privacy
// toggle settings from the Privacy screen.
// -------------------------------------------------------------------

const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn ?? '';
const POSTHOG_API_KEY = Constants.expoConfig?.extra?.posthogApiKey ?? '';
const POSTHOG_HOST = Constants.expoConfig?.extra?.posthogHost ?? 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;
let analyticsEnabled = true;
let crashReportingEnabled = true;

// ---- Initialisation ------------------------------------------------

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enabled: !__DEV__,
    enableAutoSessionTracking: true,
    attachScreenshot: true,
    debug: false,
  });
}

export function initPostHog() {
  if (!POSTHOG_API_KEY) return;

  posthogClient = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
    enableSessionReplay: false,
  });
}

// ---- Privacy Controls -----------------------------------------------

export function setAnalyticsEnabled(enabled: boolean) {
  analyticsEnabled = enabled;
  if (!enabled && posthogClient) {
    posthogClient.optOut();
  } else if (enabled && posthogClient) {
    posthogClient.optIn();
  }
}

export function setCrashReportingEnabled(enabled: boolean) {
  crashReportingEnabled = enabled;
  if (SENTRY_DSN) {
    const client = Sentry.getClient();
    if (client) {
      client.getOptions().enabled = enabled;
    }
  }
}

// ---- User Identification (anonymous) --------------------------------

export function identifyUser(userId: string) {
  if (analyticsEnabled && posthogClient) {
    posthogClient.identify(userId);
  }
  if (crashReportingEnabled && SENTRY_DSN) {
    Sentry.setUser({ id: userId });
  }
}

export function resetUser() {
  if (posthogClient) {
    posthogClient.reset();
  }
  if (SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

// ---- Event Tracking -------------------------------------------------

export const AnalyticsEvent = {
  // Onboarding
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ONBOARDING_DROPPED_OFF: 'onboarding_dropped_off',

  // Feature usage
  DIAGNOSTIC_STARTED: 'diagnostic_started',
  DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  ARTICLE_VIEWED: 'article_viewed',
  ARTICLE_READ: 'article_read',
  QUIZ_STARTED: 'quiz_started',
  QUIZ_COMPLETED: 'quiz_completed',
  GARAGE_BIKE_ADDED: 'garage_bike_added',
  GARAGE_BIKE_REMOVED: 'garage_bike_removed',
  MAINTENANCE_TASK_CREATED: 'maintenance_task_created',
  MAINTENANCE_TASK_COMPLETED: 'maintenance_task_completed',

  // Subscription funnel
  PAYWALL_VIEWED: 'paywall_viewed',
  PURCHASE_STARTED: 'purchase_started',
  PURCHASE_COMPLETED: 'purchase_completed',
  PURCHASE_CANCELLED: 'purchase_cancelled',
  SUBSCRIPTION_RESTORED: 'subscription_restored',

  // Navigation
  SCREEN_VIEWED: 'screen_viewed',
  TAB_CHANGED: 'tab_changed',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export function trackEvent(event: AnalyticsEventName, properties?: Record<string, unknown>) {
  if (!analyticsEnabled) return;

  if (posthogClient) {
    posthogClient.capture(event, properties);
  }
}

export function trackScreen(screenName: string, properties?: Record<string, unknown>) {
  if (!analyticsEnabled) return;

  if (posthogClient) {
    posthogClient.screen(screenName, properties);
  }
}

// ---- Sentry Error Helpers -------------------------------------------

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!crashReportingEnabled) return;

  if (SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}

export function addBreadcrumb(message: string, category?: string, data?: Record<string, unknown>) {
  if (!crashReportingEnabled) return;

  if (SENTRY_DSN) {
    Sentry.addBreadcrumb({ message, category, data });
  }
}

// ---- Flush ----------------------------------------------------------

export async function flushAnalytics() {
  if (posthogClient) {
    await posthogClient.flush();
  }
  if (SENTRY_DSN) {
    await Sentry.flush(2000);
  }
}
