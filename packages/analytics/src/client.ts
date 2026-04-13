import posthog from 'posthog-js';
import { EVENT_SCHEMAS } from './events';
import type { AnalyticsEventMap, AnalyticsEventName, AnalyticsUserProperties } from './types';

/**
 * Type-safe analytics client wrapping PostHog.
 *
 * - Validates event properties against Zod schemas in development.
 * - Respects Do-Not-Track headers — no-ops when DNT is enabled.
 * - Never sends PII — caller is responsible for omitting email/name/etc.
 *
 * PostHog must be initialized before calling these functions.
 * The web app does this in `instrumentation-client.ts`.
 */

function isDntEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.doNotTrack === '1';
}

/**
 * Track a typed analytics event.
 *
 * In development, properties are validated against the event's Zod schema.
 * Invalid properties log a warning but still send (fail-open) so analytics
 * never silently breaks in production.
 */
export function track<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventMap[E],
): void {
  if (isDntEnabled()) return;

  if (process.env.NODE_ENV === 'development') {
    const schema = EVENT_SCHEMAS[event];
    if (schema) {
      const result = schema.safeParse(properties);
      if (!result.success) {
        console.warn(
          `[analytics] Invalid properties for "${event}":`,
          result.error.flatten().fieldErrors,
        );
      }
    }
  }

  posthog.capture(event, properties as Record<string, unknown>);
}

/**
 * Identify a user for analytics.
 *
 * @param userId — Supabase auth user ID (UUID). Never pass email or name.
 * @param properties — optional user-level properties (plan, bikeCount, etc.)
 */
export function identify(userId: string, properties?: AnalyticsUserProperties): void {
  if (isDntEnabled()) return;
  posthog.identify(userId, properties as Record<string, unknown>);
}

/**
 * Set or update user properties without re-identifying.
 */
export function setUserProperties(properties: AnalyticsUserProperties): void {
  if (isDntEnabled()) return;
  posthog.people.set(properties as Record<string, unknown>);
}

/**
 * Reset analytics state (call on logout).
 */
export function reset(): void {
  posthog.reset();
}
