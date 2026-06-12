import type { JsonType } from '@posthog/core';
import { getStepIndex, OB_STEP_NAME, type OnboardingRoute } from '../config/onboarding';
import { type AnalyticsEventName, trackEvent } from './analytics';
import { getOnboardingVariant } from './onboarding-experiment';

// -------------------------------------------------------------------
// Onboarding funnel analytics
// -------------------------------------------------------------------
// Every onboarding event MUST carry `variant`, `step`, and `step_index`
// (A/B funnel requirement — docs/onboarding-ab-event-schema.md). These
// wrappers make that automatic; onboarding screens use them instead of
// calling trackEvent directly so the contract can't drift per call site.
//
// `variant` is also registered as a PostHog super property at assignment,
// but it is attached explicitly here too so funnel parity survives a
// failed registration (e.g. analytics toggled off during assignment).
// -------------------------------------------------------------------

/** Track a step-scoped onboarding event (viewed/completed/skipped, bike_added, …). */
export function trackOnboardingEvent(
  event: AnalyticsEventName,
  screen: OnboardingRoute,
  properties?: Record<string, JsonType>,
) {
  const variant = getOnboardingVariant();
  trackEvent(event, {
    variant,
    step: OB_STEP_NAME[screen],
    step_index: getStepIndex(variant, screen),
    ...properties,
  });
}

/** Track a flow-scoped onboarding event (started/completed/resumed) — variant only. */
export function trackOnboardingFlowEvent(
  event: AnalyticsEventName,
  properties?: Record<string, JsonType>,
) {
  trackEvent(event, { variant: getOnboardingVariant(), ...properties });
}
