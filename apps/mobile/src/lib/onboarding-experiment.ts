import {
  type AssignableObVariant,
  isAssignableObVariant,
  isObVariant,
  OB_VARIANT,
  type ObVariant,
  ONBOARDING_EXPERIMENT,
} from '../config/onboarding';
import { useExperimentStore, type VariantSource } from '../stores/experiment.store';
import { isAnalyticsEnabled, posthogClient, setUserProperties } from './analytics';

// -------------------------------------------------------------------
// Onboarding variant resolution — onboarding paywall A/B (2026-10-07)
// -------------------------------------------------------------------
// History: the 2026 A/B experiment (PostHog 83476, flag `onboarding_ab_2026`)
// was retired on 2026-08-24 and every new install got the paywall-free
// `shipped` flow. On 2026-10-07 the owner overruled the paywall removal, and new
// installs are again split — between `garage_first` and `commit_first` — by the
// flag in `ONBOARDING_EXPERIMENT.FLAG_KEY`.
//
// Rules:
//   * Assignment is sticky per install (first write wins in the store) and is
//     never re-rolled. `shipped` and the three retired arms stay valid
//     read-only values; installs holding one keep their paywall-free flow.
//   * PostHog answers with an assignable value → that value, source `posthog`.
//   * PostHog answers with anything else (flag disabled, deleted, unknown
//     value) → the kill switch, `garage_first`, source `fallback`.
//   * PostHog cannot be asked (analytics off — every EEA/UK/CH install before
//     consent — or the fetch fails/times out) → uniform on-device draw, source
//     `local`. A fixed default here would put all of Europe in one arm and turn
//     the comparison into a market comparison.
//   * `$feature_flag_called` is emitted for every assignment made while
//     analytics is on, with `locally_defaulted` marking non-PostHog values.
//
// Only a store binary that contains this code can enroll fresh installs: the
// first launch persists a variant before any OTA could apply.
// -------------------------------------------------------------------

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Dev-only variant override so QA can exercise either experiment arm (or a
 * legacy value). Set `EXPO_PUBLIC_OB_VARIANT=commit_first` in the dev shell. No
 * effect in release builds — PostHog is disabled in __DEV__ (analytics.ts), so
 * without this every dev install would draw locally.
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

const FETCH_TIMEOUT = Symbol('flag-fetch-timeout');

async function reloadFlagsWithTimeout(): Promise<Record<string, boolean | string> | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      posthogClient.reloadFeatureFlagsAsync(),
      new Promise<typeof FETCH_TIMEOUT>((resolve) => {
        timer = setTimeout(
          () => resolve(FETCH_TIMEOUT),
          ONBOARDING_EXPERIMENT.FLAG_FETCH_TIMEOUT_MS,
        );
      }),
    ]);
    if (result === FETCH_TIMEOUT) throw new Error('PostHog flag fetch timed out');
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Uniform on-device draw over the assignable variants. */
function drawLocalVariant(): AssignableObVariant {
  const arms = ONBOARDING_EXPERIMENT.ASSIGNABLE;
  return arms[Math.min(Math.floor(Math.random() * arms.length), arms.length - 1)];
}

/**
 * Exposure event (`$feature_flag_called`), emitted manually so PostHog-evaluated
 * and locally drawn installs both appear in the experiment's exposure series.
 * Registered variant is attached as a super property just before this call.
 */
function captureExposure(variant: ObVariant, locallyDefaulted: boolean) {
  if (!isAnalyticsEnabled()) return;
  posthogClient.capture('$feature_flag_called', {
    $feature_flag: ONBOARDING_EXPERIMENT.FLAG_KEY,
    $feature_flag_response: variant,
    onboarding_variant: variant,
    locally_defaulted: locallyDefaulted,
  });
}

async function decideVariant(): Promise<{ variant: ObVariant; source: VariantSource }> {
  if (!isAnalyticsEnabled()) return { variant: drawLocalVariant(), source: 'local' };
  try {
    const flags = await reloadFlagsWithTimeout();
    const value = flags?.[ONBOARDING_EXPERIMENT.FLAG_KEY];
    return isAssignableObVariant(value)
      ? { variant: value, source: 'posthog' }
      : { variant: ONBOARDING_EXPERIMENT.KILL_SWITCH, source: 'fallback' };
  } catch {
    return { variant: drawLocalVariant(), source: 'local' };
  }
}

let inFlight: Promise<ObVariant> | null = null;

async function assignNewInstall(): Promise<ObVariant> {
  const { variant, source } = await decideVariant();
  const store = useExperimentStore.getState();
  store.assignVariant(variant, source);
  // First write wins: read back what is actually stored.
  const assigned = useExperimentStore.getState().onboardingVariant ?? variant;
  // Register BEFORE the exposure so `$feature_flag_called` carries the variant.
  registerVariantWithAnalytics(assigned);
  captureExposure(assigned, source !== 'posthog');
  return assigned;
}

/**
 * Resolve (or recall) the onboarding variant. Idempotent: after the first
 * assignment it returns the persisted value without touching the network.
 * `(onboarding)/_layout` awaits this before rendering any step screen.
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

  if (!inFlight) {
    inFlight = assignNewInstall().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Synchronous read for code that runs after assignment (step screens, config
 * helpers). Degrades to `shipped` when unassigned — a paywall-free flow that
 * every pre-experiment install already uses, so a race never shows a paywall to
 * someone who was not enrolled.
 */
export function getOnboardingVariant(): ObVariant {
  return useExperimentStore.getState().onboardingVariant ?? OB_VARIANT.SHIPPED;
}
