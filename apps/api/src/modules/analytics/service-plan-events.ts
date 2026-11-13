import type { MileageUnit } from '@motovault/types';
import { hasExplicitAnalyticsConsent, NO_CONSENT_PROPERTIES } from './analytics-consent';
import { type PostHogCaptureEvent, SERVER_EVENT_PROPERTIES } from './posthog-capture';

/**
 * activation T07a (Experiment 2): a bike got its OEM service plan. Server-side, so it
 * counts every app version; the S4(b) tile reads it within 5 min of
 * `onboarding_completed`.
 */
export const SERVICE_PLAN_IMPORTED_EVENT = 'service_plan_imported' as const;

/**
 * One constant bucket for riders without a stored "yes". Not an identifier: the
 * same string for everyone (pattern of `ANONYMOUS_DISTINCT_ID`, signup sweep).
 */
export const SERVICE_PLAN_NO_CONSENT_DISTINCT_ID = 'service-plan-no-consent' as const;

/** Where the import ran. Backfill (T39) and bike edits (T23) add their own values. */
export const SERVICE_PLAN_SOURCE = {
  ONBOARDING: 'onboarding',
} as const;
export type ServicePlanSource = (typeof SERVICE_PLAN_SOURCE)[keyof typeof SERVICE_PLAN_SOURCE];

export interface ServicePlanImportedInput {
  userId: string;
  /** The rider's stored decision (`readAnalyticsDecision`); anything but `true` is "no". */
  decision: boolean | null | undefined;
  tier: string | null;
  taskCount: number;
  unit: MileageUnit;
  source: ServicePlanSource;
}

/**
 * Consent rule (plan §3A.0 rule 6): only a stored "yes" identifies the rider. A
 * "no", or no decision yet (an OAuth sign-up inside `completeOnboarding` often has
 * none), goes to the constant bucket with person processing off. No email, no
 * bike make/model: tier, count, unit and source only.
 */
export function buildServicePlanImportedEvent(
  input: ServicePlanImportedInput,
): PostHogCaptureEvent {
  const consented = hasExplicitAnalyticsConsent(input.decision);
  return {
    event: SERVICE_PLAN_IMPORTED_EVENT,
    distinct_id: consented ? input.userId : SERVICE_PLAN_NO_CONSENT_DISTINCT_ID,
    properties: {
      tier: input.tier,
      task_count: input.taskCount,
      unit: input.unit,
      source: input.source,
      ...SERVER_EVENT_PROPERTIES,
      ...(consented ? {} : NO_CONSENT_PROPERTIES),
    },
  };
}
