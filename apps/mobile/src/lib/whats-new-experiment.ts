import { isAfter, parseISO } from 'date-fns';
import {
  WHATS_NEW_ARM,
  WHATS_NEW_ARM_SOURCE,
  WHATS_NEW_EXPERIMENT,
  type WhatsNewArm,
  type WhatsNewArmSource,
} from '../config/whats-new';
import { useWhatsNewStore } from '../stores/whats-new.store';
import { isAnalyticsEnabled, posthogClient, setUserProperties } from './analytics';
import { withTimeout } from './with-timeout';

// -------------------------------------------------------------------
// What's New holdout: 50/50 on the auto-show, per experiment key.
// -------------------------------------------------------------------
// Only a rider PostHog actually assigns is held out, and only that assignment
// is remembered (sticky per experiment key). When PostHog cannot be asked
// (analytics off before consent, a failed or slow fetch) or the flag is
// missing, disabled or answers an unknown value, the rider gets What's New and
// nothing is stored, so a later decision can still receive a real variant. A
// held-out rider without analytics would add nothing to the read-out.
// After the experiment ends everyone gets What's New and PostHog is not asked.
// -------------------------------------------------------------------

export interface WhatsNewArmResolution {
  arm: WhatsNewArm;
  source: WhatsNewArmSource;
}

const ARM_SUPER_PROPERTY = 'whats_new_arm';
const FLAG_CALLED_EVENT = '$feature_flag_called';
const FLAG_TIMEOUT_MESSAGE = "PostHog What's New flag fetch timed out";

const SHOW_BY_DEFAULT: WhatsNewArmResolution = {
  arm: WHATS_NEW_ARM.TREATMENT,
  source: WHATS_NEW_ARM_SOURCE.FALLBACK,
};

const ARMS: readonly string[] = Object.values(WHATS_NEW_ARM);

function isWhatsNewArm(value: unknown): value is WhatsNewArm {
  return typeof value === 'string' && ARMS.includes(value);
}

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * Dev-only arm override so QA can see either arm. Set
 * `EXPO_PUBLIC_WHATS_NEW_ARM=holdout` in the dev shell. Never stored, and no
 * effect in release builds.
 */
function getDevArmOverride(): WhatsNewArm | null {
  if (!isDev) return null;
  const raw = process.env.EXPO_PUBLIC_WHATS_NEW_ARM;
  return isWhatsNewArm(raw) ? raw : null;
}

function experimentHasEnded(): boolean {
  return isAfter(new Date(), parseISO(WHATS_NEW_EXPERIMENT.ENDS_AT));
}

/** The arm remembered for the current experiment; an arm from an earlier one is ignored. */
function rememberedArm(): WhatsNewArm | null {
  const holdout = useWhatsNewStore.getState().holdout;
  if (holdout?.experimentKey !== WHATS_NEW_EXPERIMENT.EXPERIMENT_KEY) return null;
  return isWhatsNewArm(holdout.arm) ? holdout.arm : null;
}

/** Attach the arm to every event (super property) and to the person. */
function registerArmWithAnalytics(arm: WhatsNewArm) {
  if (!isAnalyticsEnabled()) return;
  posthogClient.register({ [ARM_SUPER_PROPERTY]: arm });
  setUserProperties({ [ARM_SUPER_PROPERTY]: arm });
}

function captureExposure(arm: WhatsNewArm) {
  if (!isAnalyticsEnabled()) return;
  posthogClient.capture(FLAG_CALLED_EVENT, {
    $feature_flag: WHATS_NEW_EXPERIMENT.FLAG_KEY,
    $feature_flag_response: arm,
    [ARM_SUPER_PROPERTY]: arm,
  });
}

async function askPosthog(): Promise<WhatsNewArm | null> {
  try {
    const flags = await withTimeout(
      posthogClient.reloadFeatureFlagsAsync(),
      WHATS_NEW_EXPERIMENT.FLAG_FETCH_TIMEOUT_MS,
      FLAG_TIMEOUT_MESSAGE,
    );
    // posthog-core resolves with no flags when the request fails or the client is disabled.
    const value = flags?.[WHATS_NEW_EXPERIMENT.FLAG_KEY];
    return isWhatsNewArm(value) ? value : null;
  } catch {
    return null;
  }
}

async function assignFromPosthog(): Promise<WhatsNewArmResolution> {
  const arm = await askPosthog();
  if (!arm) return SHOW_BY_DEFAULT;
  const store = useWhatsNewStore.getState();
  store.setHoldoutArm(WHATS_NEW_EXPERIMENT.EXPERIMENT_KEY, arm);
  // First write wins: report what is actually stored.
  const assigned = rememberedArm() ?? arm;
  // Register before the exposure so the exposure carries the arm.
  registerArmWithAnalytics(assigned);
  captureExposure(assigned);
  return { arm: assigned, source: WHATS_NEW_ARM_SOURCE.POSTHOG };
}

let inFlight: Promise<WhatsNewArmResolution> | null = null;

/**
 * Decide whether this rider gets the What's New auto-show (treatment) or is held
 * out. A remembered PostHog arm is returned without touching the network.
 */
export function resolveWhatsNewArm(): Promise<WhatsNewArmResolution> {
  const override = getDevArmOverride();
  if (override) return Promise.resolve({ arm: override, source: WHATS_NEW_ARM_SOURCE.FALLBACK });

  if (experimentHasEnded()) return Promise.resolve(SHOW_BY_DEFAULT);

  const remembered = rememberedArm();
  if (remembered) {
    registerArmWithAnalytics(remembered);
    return Promise.resolve({ arm: remembered, source: WHATS_NEW_ARM_SOURCE.POSTHOG });
  }

  if (!isAnalyticsEnabled()) return Promise.resolve(SHOW_BY_DEFAULT);

  if (!inFlight) {
    inFlight = assignFromPosthog().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
