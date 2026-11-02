import type { PostHog } from 'posthog-js';
import { shouldDropPostHogEvent } from '@/lib/sentry-noise-filter';

/**
 * PostHog, loaded after the consent decision instead of in every page's
 * first-load bundle. `CookieConsentProvider` calls {@link loadPostHog} once
 * analytics are allowed (a stored or new "yes", or the automatic grant
 * outside the EU); a visitor who never says yes never downloads the SDK.
 *
 * Calls made before the SDK is in ({@link withPostHog}) wait in a short
 * queue and run right after `init`, BEFORE a new opt-in is applied — so they
 * keep today's semantics: captured for a visitor whose stored opt-in PostHog
 * reads at init, dropped (opted out) for a first-time visitor who only just
 * said yes. A "no" empties the queue.
 */

const MAX_QUEUED_CALLS = 50;

let instance: PostHog | null = null;
let loading: Promise<PostHog> | null = null;
let queue: Array<(posthog: PostHog) => void> = [];

function runSafely(fn: (posthog: PostHog) => void, posthog: PostHog) {
  try {
    fn(posthog);
  } catch {
    // Blocked storage makes PostHog calls throw (Sentry MOTOVAULT-WEB-T);
    // analytics never break the page.
  }
}

/** Imports and initialises PostHog once; later calls get the same promise. */
export function loadPostHog(): Promise<PostHog> {
  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        if (process.env.NODE_ENV === 'production') {
          // GDPR: `opt_out_capturing_by_default` sends nothing (pageviews and
          // $exception included) until opt_in_capturing(); `persistence:
          // 'memory'` writes no `ph_` cookie before that. applyPostHogConsent
          // (cookie-consent.tsx) switches persistence to 'localStorage+cookie'
          // before opting in, so the opt-out flag must be read from
          // localStorage too, or the SDK stays opted out on every load.
          posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? '', {
            api_host: '/ingest',
            ui_host: 'https://eu.posthog.com',
            capture_pageview: 'history_change',
            capture_exceptions: true,
            opt_out_capturing_by_default: true,
            persistence: 'memory',
            opt_out_capturing_persistence_type: 'localStorage',
            // The same un-actionable third-party / in-app-browser noise
            // Sentry's beforeSend drops; see shouldDropPostHogEvent.
            before_send: (event) => (shouldDropPostHogEvent(event) ? null : event),
          });
        }
        instance = posthog;
        const pending = queue;
        queue = [];
        for (const fn of pending) runSafely(fn, posthog);
        return posthog;
      })
      .catch((error: unknown) => {
        // A failed chunk load (offline, blocked) may be retried on the next call.
        loading = null;
        throw error;
      });
  }
  return loading;
}

/** Runs `fn` with PostHog now if it is loaded, otherwise once it loads. */
export function withPostHog(fn: (posthog: PostHog) => void): void {
  if (instance) {
    runSafely(fn, instance);
    return;
  }
  if (queue.length < MAX_QUEUED_CALLS) queue.push(fn);
}

/** The loaded SDK, or null before consent. */
export function getPostHog(): PostHog | null {
  return instance;
}

/** A "no": nothing that waited for the SDK may run later. */
export function dropQueuedPostHogCalls(): void {
  queue = [];
}
