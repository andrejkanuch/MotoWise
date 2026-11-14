import type { CompleteOnboardingMutation } from '@motovault/graphql';
import type { JsonType } from '@posthog/core';
import { getStepIndex, OB_STEP_NAME, type OnboardingRoute } from '../config/onboarding';
import { AnalyticsEvent, type AnalyticsEventName, trackEvent } from './analytics';
import { getOnboardingVariant } from './onboarding-experiment';
import { recordOnboardingCompleted } from './paywall-session';

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
    // Full-flow position, deliberately not the progress bar's visible index:
    // funnels compare step_index across bike/no-bike riders and over time.
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

/** What `completeOnboarding` returned: carries the service plan the API imported. */
export type OnboardingCompletedUser = Pick<
  CompleteOnboardingMutation['completeOnboarding'],
  'servicePlanTaskCount' | 'servicePlanTier'
>;

/**
 * The onboarding bike's service plan as `onboarding_completed` reports it
 * (issue 365 T07b, Experiment 2): the imported task count (0 when nothing was
 * imported, or an older API sent no count) and the tier (`model` | `make` |
 * `generic`) only when there is one.
 */
export function servicePlanCompletionFields(
  user: OnboardingCompletedUser,
): Record<string, JsonType> {
  return {
    service_plan_task_count: user.servicePlanTaskCount ?? 0,
    ...(user.servicePlanTier && { service_plan_tier: user.servicePlanTier }),
  };
}

/**
 * Track `onboarding_completed` with the service plan of `completedUser`, and
 * start the clock that paywall events report as
 * `minutes_since_onboarding_completed` (issue 365 T05a).
 */
export function trackOnboardingCompletion(
  completedUser: OnboardingCompletedUser,
  properties?: Record<string, JsonType>,
) {
  recordOnboardingCompleted();
  trackOnboardingFlowEvent(AnalyticsEvent.ONBOARDING_COMPLETED, {
    ...properties,
    ...servicePlanCompletionFields(completedUser),
  });
}
