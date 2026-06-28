import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { isAnalyticsEnabled, posthogClient } from './analytics';
import { getStoredAnalyticsConsent } from './analytics-consent';

const STORE_KEYS = {
  FBCLID: 'meta_fbclid',
  UTM_CONTENT: 'meta_utm_content',
  UTM_SOURCE: 'meta_utm_source',
  UTM_CAMPAIGN: 'meta_utm_campaign',
  CAPTURED: 'meta_captured',
  FIRST_SEEN_AT: 'meta_first_seen_at',
  INSTALL_VERSION: 'meta_install_version',
} as const;

/** Real PostHog event the first-touch install $set_once attaches to. */
const INSTALL_EVENT = 'install_attribution_captured';

const MAX_PARAM_LENGTH = 256;

/** Sanitize deep link param: trim to max length, strip non-safe characters. */
function sanitize(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, MAX_PARAM_LENGTH).replace(/[^\w.-]/g, '');
}

/**
 * Captures install attribution on first app open: parses fbclid + UTM from the
 * initial deep link (when present), persists them, and stamps first-touch install
 * source as `$set_once` person properties on the (still anonymous) PostHog person.
 * Called once on first app open in _layout.tsx; skips once successfully captured.
 *
 * Design (see docs/plans/2026-06-28-001-feat-attribution-instrumentation-plan.md):
 * - Fires for EVERY first launch, including organic installs with no deep link
 *   (install_source = 'organic_unknown') — App Store search is the dominant path.
 * - UTM source/campaign are persisted whenever a source is present, independent of
 *   utm_content, so source-only links are recoverable by getStoredUtmProperties.
 * - `$set_once` so a later launch/link can never overwrite the original first touch.
 * - Consent-gated: the PostHog emit is suppressed until analytics consent is given,
 *   and CAPTURED is only flagged once the emit fires — so an opted-out→opted-in
 *   user is not permanently lost. fbclid/UTM stay on-device in SecureStore (only
 *   transmitted later, on consented registration).
 *
 * Deduplicated via a shared in-flight promise so concurrent callers (the cold-start
 * effect AND the anonymous-RevenueCat sequencing in _layout.tsx) share one run and
 * never race on the SecureStore writes / CAPTURED flag.
 */
let capturePromise: Promise<void> | null = null;

export function captureMetaAttribution(): Promise<void> {
  if (!capturePromise) {
    capturePromise = doCaptureMetaAttribution()
      .then((emitted) => {
        // If nothing was emitted (consent was off), release the memo so a later
        // call — after opt-in or on the next launch within this runtime — retries.
        if (!emitted) capturePromise = null;
      })
      .catch(() => {
        // Never poison future callers on an unexpected failure.
        capturePromise = null;
      });
  }
  return capturePromise;
}

/** Returns true iff the install-attribution event was emitted (and CAPTURED set). */
async function doCaptureMetaAttribution(): Promise<boolean> {
  try {
    const alreadyCaptured = await SecureStore.getItemAsync(STORE_KEYS.CAPTURED);
    if (alreadyCaptured) return true;

    // Parse the initial deep link if there is one. Organic installs have none —
    // that is expected and must NOT short-circuit the install-source emit.
    const url = await Linking.getInitialURL();
    let fbclid: string | null = null;
    let utmContent: string | null = null;
    let utmSource: string | null = null;
    let utmCampaign: string | null = null;
    if (url) {
      const parsed = new URL(url);
      fbclid = sanitize(parsed.searchParams.get('_fbclid') ?? parsed.searchParams.get('fbclid'));
      utmContent = sanitize(parsed.searchParams.get('utm_content'));
      utmSource = sanitize(parsed.searchParams.get('utm_source'));
      utmCampaign = sanitize(parsed.searchParams.get('utm_campaign'));
    }

    // Persist fbclid for CAPI attribution (MOT-209).
    if (fbclid) await SecureStore.setItemAsync(STORE_KEYS.FBCLID, fbclid);

    // Persist UTM for PostHog/RC segmentation (MOT-210). Store each key whenever it
    // is present — NOT gated on utm_content — so source-only / campaign-only links
    // (common for non-Meta channels) are recoverable downstream (KTD-4).
    if (utmSource) await SecureStore.setItemAsync(STORE_KEYS.UTM_SOURCE, utmSource);
    if (utmContent) await SecureStore.setItemAsync(STORE_KEYS.UTM_CONTENT, utmContent);
    if (utmCampaign) await SecureStore.setItemAsync(STORE_KEYS.UTM_CAMPAIGN, utmCampaign);

    // Resolve the effective first-touch UTM, preferring this launch's values but
    // falling back to anything persisted on an earlier (e.g. pre-consent) launch,
    // so a real source captured before consent is not later replaced by 'organic'.
    const sourceForInstall = utmSource ?? (await SecureStore.getItemAsync(STORE_KEYS.UTM_SOURCE));
    const contentForInstall =
      utmContent ?? (await SecureStore.getItemAsync(STORE_KEYS.UTM_CONTENT));
    const campaignForInstall =
      utmCampaign ?? (await SecureStore.getItemAsync(STORE_KEYS.UTM_CAMPAIGN));

    // Persist first-seen timestamp + app version on the very FIRST launch (any
    // consent state) and emit those persisted values — so for an opted-out→opted-in
    // user the emit reflects the true install, not the first consented launch.
    let firstSeenAt = await SecureStore.getItemAsync(STORE_KEYS.FIRST_SEEN_AT);
    if (!firstSeenAt) {
      firstSeenAt = new Date().toISOString();
      await SecureStore.setItemAsync(STORE_KEYS.FIRST_SEEN_AT, firstSeenAt);
    }
    let installVersion = await SecureStore.getItemAsync(STORE_KEYS.INSTALL_VERSION);
    if (!installVersion) {
      installVersion = Constants.expoConfig?.version ?? 'unknown';
      await SecureStore.setItemAsync(STORE_KEYS.INSTALL_VERSION, installVersion);
    }

    // Emit first-touch install attribution — consent-gated. Only mark CAPTURED (and
    // return true) if the emit actually fired, so an opted-out→opted-in user still
    // gets attributed on a later launch (KTD-9). Uses a real event name (not the
    // synthetic `$set`) so $set_once attaches to a visible event on the anon person.
    if (isAnalyticsEnabled() && getStoredAnalyticsConsent() && posthogClient) {
      posthogClient.capture(INSTALL_EVENT, {
        $set_once: {
          install_source: sourceForInstall ?? 'organic_unknown',
          install_platform: process.env.EXPO_OS ?? 'unknown',
          install_version: installVersion,
          first_seen_at: firstSeenAt,
          ...(sourceForInstall && { utm_source: sourceForInstall }),
          ...(contentForInstall && { utm_content: contentForInstall }),
          ...(campaignForInstall && { utm_campaign: campaignForInstall }),
        },
      });
      await SecureStore.setItemAsync(STORE_KEYS.CAPTURED, '1');
      return true;
    }
    return false;
  } catch {
    // Silently ignore — attribution is best-effort, don't crash the app.
    return false;
  }
}

/**
 * Returns stored UTM properties for carrying forward on posthog.identify() and the
 * RevenueCat `$mediaSource` write. Returns null only when no UTM key is stored —
 * NOT gated on utm_content (KTD-4), so source-only links are honored.
 */
export async function getStoredUtmProperties(): Promise<Record<string, string> | null> {
  try {
    const utmSource = await SecureStore.getItemAsync(STORE_KEYS.UTM_SOURCE);
    const utmContent = await SecureStore.getItemAsync(STORE_KEYS.UTM_CONTENT);
    const utmCampaign = await SecureStore.getItemAsync(STORE_KEYS.UTM_CAMPAIGN);
    if (!utmSource && !utmContent && !utmCampaign) return null;
    return {
      ...(utmSource && { utm_source: utmSource }),
      ...(utmContent && { utm_content: utmContent }),
      ...(utmCampaign && { utm_campaign: utmCampaign }),
    };
  } catch {
    return null;
  }
}

/**
 * Returns the stored fbclid for passing to the API on registration.
 */
export async function getStoredFbclid(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORE_KEYS.FBCLID);
  } catch {
    return null;
  }
}

/**
 * Clears the stored fbclid after it has been used for registration.
 */
export async function clearStoredFbclid(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORE_KEYS.FBCLID);
  } catch {
    // Ignore
  }
}
