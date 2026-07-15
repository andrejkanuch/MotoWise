import { MotorcycleMakesDocument } from '@motovault/graphql';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import {
  AnalyticsEvent,
  captureException,
  registerSuperProperties,
  setUserPropertiesOnce,
  trackEvent,
} from './analytics';
import { gqlFetcher } from './graphql-client';
import {
  getIntentCohort,
  INTENT_METHOD,
  INTENT_PREFILL_ENABLED,
  INTENT_TOKEN_URL_PREFIX,
  type IntentMethod,
  type MakeOption,
  parseIntentToken,
  seedBikeDataFromIntent,
} from './pending-intent';

/**
 * First-launch resolver for the web→app "which bike" intent (P2). Reads the
 * platform transport (Android Play install referrer / iOS clipboard token),
 * parses it, and — only on a confident make match — seeds the onboarding store
 * so the rider lands in a pre-filled garage. Fires the attribution analytics.
 *
 * RULE #0 — this is a non-blocking, best-effort side effect. It NEVER throws,
 * NEVER blocks render/navigation, and any failure leaves onboarding untouched.
 * Runs at most once per install (SecureStore flag); the transports are one-shot
 * (the clipboard token is cleared on read; the referrer reflects a single
 * install), so there is nothing to retry.
 */

/** SecureStore flag: the intent transport has already been consumed this install. */
const INTENT_CHECKED_KEY = 'pending_intent_checked';

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

async function readIosClipboardToken(): Promise<string | null> {
  try {
    // Gate the read behind hasUrlAsync() — a metadata check that does NOT trigger
    // the iOS paste-permission prompt. Organic users (no URL on the clipboard)
    // return here silently, so the prompt is never shown outside the web→app
    // flow. Only a URL-bearing clipboard proceeds to the prompting read.
    if (!(await Clipboard.hasUrlAsync())) return null;
    const clip = await Clipboard.getStringAsync();
    // Only trust — and only ever clear — a string that is our token. Never touch
    // unrelated clipboard content the user happens to be carrying.
    if (!clip?.startsWith(INTENT_TOKEN_URL_PREFIX)) return null;
    await Clipboard.setStringAsync('');
    return clip;
  } catch {
    return null;
  }
}

async function readTransport(): Promise<{ raw: string; method: IntentMethod } | null> {
  if (process.env.EXPO_OS === 'android') {
    const raw = await readAndroidReferrer();
    return raw ? { raw, method: INTENT_METHOD.REFERRER } : null;
  }
  if (process.env.EXPO_OS === 'ios') {
    const raw = await readIosClipboardToken();
    return raw ? { raw, method: INTENT_METHOD.CLIPBOARD } : null;
  }
  return null;
}

async function fetchMakes(): Promise<MakeOption[]> {
  try {
    const data = await gqlFetcher(MotorcycleMakesDocument);
    return data.motorcycleMakes ?? [];
  } catch {
    return [];
  }
}

export async function resolvePendingIntent(): Promise<void> {
  if (!INTENT_PREFILL_ENABLED) return;
  try {
    if (await SecureStore.getItemAsync(INTENT_CHECKED_KEY)) return;

    const transport = await readTransport();
    // One-shot: mark checked as soon as we've read (or determined there is
    // nothing to read). The transports cannot be re-read, so never retry.
    await SecureStore.setItemAsync(INTENT_CHECKED_KEY, '1');
    if (!transport) return; // organic install / no intent → normal flow

    const intent = parseIntentToken(transport.raw);
    if (!intent) return; // garbage / expired token → normal flow

    const makes = await fetchMakes();
    const matched = seedBikeDataFromIntent(intent, makes);

    // Attribution — fire only after we know the outcome. Consent-gated inside
    // the analytics helpers, so this is safe to call unconditionally.
    trackEvent(AnalyticsEvent.PENDING_INTENT_RESOLVED, {
      source: intent.source,
      make: intent.make,
      model: intent.model,
      method: transport.method,
      matched,
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
  } catch (e) {
    captureException(e, { source: 'pending-intent-reader.resolvePendingIntent' });
  }
}
