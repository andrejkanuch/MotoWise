import { isObVariant, OB_VARIANT, type ObVariant } from '../config/onboarding';
import { useExperimentStore, type VariantSource } from '../stores/experiment.store';
import { isAnalyticsEnabled, posthogClient, setUserProperties } from './analytics';

// -------------------------------------------------------------------
// Onboarding variant resolution — post-experiment
// -------------------------------------------------------------------
// The 2026 A/B experiment (PostHog 83476, flag `onboarding_ab_2026`) is RETIRED
// as of 2026-08-24: `lean` won on onboarding completion (40.5% vs 29.4%) and
// bike-add (75.2% vs 64.7%), each at roughly p≈0.02, and one flow now ships.
//
// What that means here:
//   * assignment no longer consults PostHog at all. There is no flag fetch, no
//     2s network budget, and no offline-fallback branch — a single flow cannot
//     fail to be assigned, so `resolveOnboardingVariant` is now synchronous
//     work wrapped in a resolved promise. New installs get `shipped`.
//   * the READ path is untouched. ~423 installs have `lean`, `invested` or
//     `control` persisted in MMKV, and every one of those values still resolves
//     (all four map to the same flow in ONBOARDING_FLOWS). Nobody is re-rolled,
//     reset, or stranded mid-onboarding.
//   * `onboarding_variant` is still registered as a super property and a person
//     property. Deliberately: it is the only record of which flow a given user
//     went through, and clearing it would destroy the ability to read the arms'
//     retention retrospectively. Retiring the arms is not deleting the concept.
//   * `$feature_flag_called` is no longer emitted. The flag is stopped, so
//     continuing to report exposures for it would add rows to a series nobody
//     can act on and make the stopped experiment look live.
//
// On the "33 NULL variant" users the plan flagged: NOT an assignment failure.
// Checked against PostHog 2026-08-24 — all 33 are on app versions 3.8.0 (29),
// 3.9.0 (3) and 3.3.0 (1), i.e. builds that predate the assignment code
// entirely. They are the slow-updating tail, not a bug.
//
// It is specifically NOT analytics consent, which was the intuitive guess: with
// consent off `trackEvent` no-ops (see analytics.ts), so those users emit no
// events at all and cannot show up in PostHog as a null-variant cohort.
//
// Assignment is total by construction now — every install gets a value on first
// launch, and an unassigned read degrades to `shipped` rather than to a variant
// whose flow no longer exists.
//
// Related: `control` accumulated 8 users despite a 0% rollout, via the old
// "flag fetched but disabled/unknown value" branch. That branch is gone.
// -------------------------------------------------------------------

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Dev-only variant override, kept so QA can still exercise a LEGACY value and
 * confirm a persisted `invested` / `control` install completes the shipped flow
 * without a reset. Set `EXPO_PUBLIC_OB_VARIANT=invested` in the dev shell. No
 * effect in release builds.
 */
function getDevVariantOverride(): ObVariant | null {
  if (!isDev) return null;
  const raw = process.env.EXPO_PUBLIC_OB_VARIANT;
  return isObVariant(raw) ? raw : null;
}

/**
 * Attach the variant to all analytics: as a super property (every event) and as
 * a person property (cohorts/funnels). Safe to call repeatedly — also used on
 * later launches to re-register the super property in a fresh runtime.
 */
function registerVariantWithAnalytics(variant: ObVariant) {
  if (!isAnalyticsEnabled()) return;
  posthogClient.register({ onboarding_variant: variant });
  setUserProperties({ onboarding_variant: variant });
}

/** Source recorded for a post-experiment assignment. */
const SHIPPED_SOURCE: VariantSource = 'shipped';

/**
 * Resolve (or recall) the onboarding variant. Idempotent: after the first
 * assignment it returns the persisted value untouched.
 *
 * Still returns a promise. The signature is load-bearing for the caller —
 * `(onboarding)/_layout` awaits this before rendering any step screen — and
 * keeping it async means the retirement is a one-file change rather than a
 * refactor of the layout's gating.
 */
export function resolveOnboardingVariant(): Promise<ObVariant> {
  // Dev override wins over persistence so QA can switch arms by changing the env
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

  useExperimentStore.getState().assignVariant(OB_VARIANT.SHIPPED, SHIPPED_SOURCE);
  registerVariantWithAnalytics(OB_VARIANT.SHIPPED);
  return Promise.resolve(OB_VARIANT.SHIPPED);
}

/**
 * Synchronous read for code that runs after assignment (step screens, config
 * helpers). Degrades to `shipped` when unassigned — the flow every variant
 * resolves to anyway, and the only value guaranteed to exist post-retirement.
 */
export function getOnboardingVariant(): ObVariant {
  return useExperimentStore.getState().onboardingVariant ?? OB_VARIANT.SHIPPED;
}
