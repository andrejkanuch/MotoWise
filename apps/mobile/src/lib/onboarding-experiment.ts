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
//
// Exposure: we read the variant from `reloadFeatureFlagsAsync()`'s resolved map
// rather than `getFeatureFlag()`. `getFeatureFlag()` auto-fires
// `$feature_flag_called` *before* we can register the `onboarding_variant`
// super property, so that one exposure event would miss it. Reading the map
// fires nothing, so we register first and then emit a single enriched exposure
// on BOTH the happy and fallback paths — symmetric, and always carrying the
// variant as a super property.
// -------------------------------------------------------------------

/** Budget for the flag fetch — onboarding must never block on the network. */
const FLAG_FETCH_TIMEOUT_MS = 2000;

const FETCH_TIMEOUT = Symbol('flag-fetch-timeout');

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Dev-only variant override. In a `__DEV__` build PostHog is disabled
 * (analytics.ts), so the flag never evaluates and every install would resolve
 * to CONTROL — making it impossible to exercise lean/invested locally. Set
 * `EXPO_PUBLIC_OB_VARIANT=invested` (or `lean`/`control`) in the dev shell to
 * force an arm. No effect in release builds.
 */
function getDevVariantOverride(): ObVariant | null {
  if (!isDev) return null;
  const raw = process.env.EXPO_PUBLIC_OB_VARIANT;
  return isObVariant(raw) ? raw : null;
}

async function reloadFlagsWithTimeout(): Promise<Record<string, boolean | string> | undefined> {
  const result = await Promise.race([
    posthogClient.reloadFeatureFlagsAsync(),
    new Promise<typeof FETCH_TIMEOUT>((resolve) =>
      setTimeout(() => resolve(FETCH_TIMEOUT), FLAG_FETCH_TIMEOUT_MS),
    ),
  ]);
  if (result === FETCH_TIMEOUT) throw new Error('PostHog flag fetch timed out');
  return result;
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

/**
 * Exposure event (`$feature_flag_called`). Emitted manually for every source so
 * the series is complete and consistent: PostHog-evaluated, offline-defaulted,
 * and dev-overridden users all get one exposure that carries the variant as a
 * super property (registered just before this call). `locally_defaulted` flags
 * the non-PostHog assignments so they can be reconciled / excluded.
 */
function captureExposure(variant: ObVariant, locallyDefaulted: boolean) {
  if (!isAnalyticsEnabled()) return;
  posthogClient.capture('$feature_flag_called', {
    $feature_flag: EXPERIMENT_FLAG_KEY,
    $feature_flag_response: variant,
    onboarding_variant: variant,
    locally_defaulted: locallyDefaulted,
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
  // Dev override wins over persistence so QA can re-roll by changing the env
  // var and relaunching (no need to clear MMKV).
  const override = getDevVariantOverride();
  if (override) {
    const store = useExperimentStore.getState();
    if (store.onboardingVariant !== override) {
      store.reset();
      store.assignVariant(override, 'override');
    }
    registerVariantWithAnalytics(override);
    return Promise.resolve(override);
  }

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
    const flags = await reloadFlagsWithTimeout();
    const value = flags?.[EXPERIMENT_FLAG_KEY];
    // Disabled or unknown variant after a successful fetch = kill switch →
    // route to the existing V4 flow.
    variant = isObVariant(value) ? value : OB_VARIANT.CONTROL;
    source = 'posthog';
  } catch {
    variant = OB_VARIANT.LEAN;
    source = 'fallback';
  }

  useExperimentStore.getState().assignVariant(variant, source);
  // Register BEFORE the exposure so `$feature_flag_called` carries the variant.
  registerVariantWithAnalytics(variant);
  captureExposure(variant, source !== 'posthog');
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
