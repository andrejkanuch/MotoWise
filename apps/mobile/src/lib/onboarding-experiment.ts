import { EXPERIMENT_FLAG_KEY, isObVariant, OB_VARIANT, type ObVariant } from '../config/onboarding';
import { useExperimentStore, type VariantSource } from '../stores/experiment.store';
import { isAnalyticsEnabled, posthogClient, setUserProperties } from './analytics';

// -------------------------------------------------------------------
// Onboarding A/B experiment assignment (PostHog `onboarding_ab_2026`)
// -------------------------------------------------------------------
// Resolves the user's variant ONCE at first launch, before the onboarding
// welcome screen renders, and persists it (MMKV via experiment.store) so it
// is stable across resume-after-kill and never re-rolls mid-flow.
//
// Failure policy (spec: onboarding-abc-test-plan.md):
// - Flag fetch fails / times out (offline, PostHog down, no API key)
//   → default to LEAN, record locally with source 'fallback'.
// - Flag fetched but disabled / unknown value (deliberate kill switch)
//   → CONTROL = the pre-test V4 flow (safe degradation).
// The user is never left without a flow.
// -------------------------------------------------------------------

/** Budget for the flag fetch — onboarding must never block on the network. */
const FLAG_FETCH_TIMEOUT_MS = 2000;

const FETCH_TIMEOUT = Symbol('flag-fetch-timeout');

async function reloadFlagsWithTimeout(): Promise<void> {
  const result = await Promise.race([
    posthogClient.reloadFeatureFlagsAsync(),
    new Promise<typeof FETCH_TIMEOUT>((resolve) =>
      setTimeout(() => resolve(FETCH_TIMEOUT), FLAG_FETCH_TIMEOUT_MS),
    ),
  ]);
  if (result === FETCH_TIMEOUT) throw new Error('PostHog flag fetch timed out');
}

/**
 * Attach the variant to all analytics: as a super property (every event) and
 * as a person property (cohorts/funnels). Safe to call repeatedly — also used
 * on later launches to re-register the super property in a fresh runtime.
 */
function registerVariantWithAnalytics(variant: ObVariant) {
  if (!isAnalyticsEnabled()) return;
  posthogClient.register({ onboarding_variant: variant });
  setUserProperties({ onboarding_variant: variant });
}

/** Exposure event so PostHog experiment results include locally-defaulted users. */
function captureFallbackExposure(variant: ObVariant) {
  if (!isAnalyticsEnabled()) return;
  // getFeatureFlag() fires `$feature_flag_called` automatically on the happy
  // path; on the fallback path we mirror it manually (flagged as a local
  // default) so the exposure series stays complete and reconcilable.
  posthogClient.capture('$feature_flag_called', {
    $feature_flag: EXPERIMENT_FLAG_KEY,
    $feature_flag_response: variant,
    locally_defaulted: true,
  });
}

// Single-flight: concurrent callers (layout remounts, StrictMode double
// effects) share one resolution instead of racing duplicate assignments.
let inFlight: Promise<ObVariant> | null = null;

/**
 * Resolve (or recall) the onboarding variant. Idempotent: after the first
 * assignment it returns the persisted variant without touching the network.
 */
export function resolveOnboardingVariant(): Promise<ObVariant> {
  const persisted = useExperimentStore.getState().onboardingVariant;
  if (persisted) {
    registerVariantWithAnalytics(persisted);
    return Promise.resolve(persisted);
  }
  if (!inFlight) {
    inFlight = doResolve().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doResolve(): Promise<ObVariant> {
  let variant: ObVariant;
  let source: VariantSource;
  try {
    await reloadFlagsWithTimeout();
    // Fires `$feature_flag_called` (exposure) automatically.
    const value = posthogClient.getFeatureFlag(EXPERIMENT_FLAG_KEY);
    // Disabled or unknown variant after a successful fetch = kill switch →
    // route to the existing V4 flow.
    variant = isObVariant(value) ? value : OB_VARIANT.CONTROL;
    source = 'posthog';
  } catch {
    variant = OB_VARIANT.LEAN;
    source = 'fallback';
  }

  useExperimentStore.getState().assignVariant(variant, source);
  registerVariantWithAnalytics(variant);
  if (source === 'fallback') captureFallbackExposure(variant);
  return variant;
}

/**
 * Synchronous read for code that runs after assignment (step screens, config
 * helpers). Returns CONTROL when unassigned — pre-experiment users and any
 * path that races assignment degrade to the current V4 behavior.
 */
export function getOnboardingVariant(): ObVariant {
  return useExperimentStore.getState().onboardingVariant ?? OB_VARIANT.CONTROL;
}
