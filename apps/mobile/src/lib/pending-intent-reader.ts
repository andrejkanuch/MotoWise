import * as SecureStore from 'expo-secure-store';
import { useOnboardingStore } from '../stores/onboarding.store';
import {
  AnalyticsEvent,
  captureException,
  registerSuperProperties,
  setUserPropertiesOnce,
  trackEvent,
} from './analytics';
import {
  getIntentCohort,
  INTENT_METHOD,
  INTENT_PREFILL_ENABLED,
  type IntentMethod,
  parseIntentToken,
} from './pending-intent';

/**
 * First-launch resolver for the web→app "which bike" intent (P2). Reads the
 * Android Play install referrer, parses it, and stores the raw pendingIntent. The
 * make is resolved (and the bike seeded) later in bike-setup, which already loads
 * the make list. Fires attribution.
 *
 * iOS has NO intent transport: the App Store strips install referrers, and the
 * only alternative — reading the clipboard on launch — triggers an iOS paste
 * prompt on every first launch, so that path was intentionally removed. On iOS
 * this is a no-op and onboarding runs normally.
 *
 * RULE #0 — this is a non-blocking, best-effort side effect. It NEVER throws,
 * NEVER blocks render/navigation, and any failure leaves onboarding untouched.
 * Runs at most once per install (SecureStore flag); the referrer reflects a
 * single install, so there is nothing to retry.
 */

/** SecureStore flag: the intent transport has already been consumed this install. */
const INTENT_CHECKED_KEY = 'pending_intent_checked';

/**
 * Hard ceiling on the whole resolution flow. The Play Referrer native callback
 * (and, in theory, a SecureStore call) can stall indefinitely; the paywall waits
 * on `intentResolved`, so an unbounded read would trap the rider on a loading
 * state. On expiry we abandon the read and fall through to the no-intent path.
 */
const RESOLVE_TIMEOUT_MS = 4000;

/** Reject after `ms` so a stalled await can't hang the resolution flow. */
function rejectAfter(ms: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('pending-intent resolution timed out')), ms);
  });
}

/**
 * Shape of react-native-play-install-referrer (Android-only). Dynamically
 * required so iOS never loads it and Expo Go (no native module) degrades to a
 * no-op instead of crashing.
 */
interface PlayInstallReferrerModule {
  PlayInstallReferrer: {
    getInstallReferrerInfo(
      cb: (info: { installReferrer?: string } | null, error: Error | null) => void,
    ): void;
  };
}

async function readAndroidReferrer(): Promise<string | null> {
  try {
    // Dynamically required (Android-only module) so iOS never loads it and Expo
    // Go — where the native module is absent — degrades to a no-op via the catch.
    const mod = require('react-native-play-install-referrer') as PlayInstallReferrerModule;
    const referrer = await new Promise<string | null>((resolve) => {
      mod.PlayInstallReferrer.getInstallReferrerInfo((info, error) => {
        resolve(error || !info?.installReferrer ? null : info.installReferrer);
      });
    });
    return referrer;
  } catch {
    return null;
  }
}

async function readTransport(): Promise<{ raw: string; method: IntentMethod } | null> {
  // Android only — the Play install referrer. iOS has no silent transport (see
  // the module doc), so it is intentionally a no-op there.
  if (process.env.EXPO_OS === 'android') {
    const raw = await readAndroidReferrer();
    return raw ? { raw, method: INTENT_METHOD.REFERRER } : null;
  }
  return null;
}

async function readAndStoreIntent(): Promise<void> {
  if (await SecureStore.getItemAsync(INTENT_CHECKED_KEY)) return;

  const transport = await readTransport();
  // One-shot: mark checked as soon as we've read (or determined there is
  // nothing to read). The transports cannot be re-read, so never retry.
  await SecureStore.setItemAsync(INTENT_CHECKED_KEY, '1');
  if (!transport) return; // organic install / no intent → normal flow

  const intent = parseIntentToken(transport.raw);
  if (!intent) return; // garbage / expired token → normal flow

  // Store the raw intent. The make is resolved + the bike seeded in bike-setup
  // (where the make list is already loaded), so no network fetch is needed here
  // at cold start. An unknown make degrades gracefully there (normal grid).
  useOnboardingStore.getState().setPendingIntent(intent);

  // Attribution — consent-gated inside the analytics helpers, safe to call
  // unconditionally.
  trackEvent(AnalyticsEvent.PENDING_INTENT_RESOLVED, {
    source: intent.source,
    make: intent.make,
    model: intent.model,
    method: transport.method,
  });
  // Extend the first-touch install attribution with the intent (set-once so a
  // later launch/link can never overwrite the original).
  setUserPropertiesOnce({
    intent_make: intent.make,
    intent_model: intent.model,
    intent_source: intent.source,
  });
  // Durable cohort tag for whole-funnel segmentation + paywall personalization.
  registerSuperProperties({ intent_cohort: getIntentCohort(intent) });
}

export async function resolvePendingIntent(): Promise<void> {
  try {
    if (!INTENT_PREFILL_ENABLED) return;
    // Bound the whole read: a stalled Play Referrer callback (or SecureStore
    // call) must never hang the paywall, which waits on `intentResolved`. On
    // timeout we abandon the read and fall through to the no-intent path.
    await Promise.race([readAndStoreIntent(), rejectAfter(RESOLVE_TIMEOUT_MS)]);
  } catch (e) {
    captureException(e, { source: 'pending-intent-reader.resolvePendingIntent' });
  } finally {
    // Signal that resolution has settled (any path — kill-switch off, already
    // checked, intent found, timed out, or error). The paywall waits on this so a
    // late-arriving intent can still select the maintenance placement.
    useOnboardingStore.getState().setIntentResolved(true);
  }
}
