import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { posthogClient } from './analytics';

const STORE_KEYS = {
  FBCLID: 'meta_fbclid',
  UTM_CONTENT: 'meta_utm_content',
  UTM_SOURCE: 'meta_utm_source',
  UTM_CAMPAIGN: 'meta_utm_campaign',
  CAPTURED: 'meta_captured',
} as const;

const MAX_PARAM_LENGTH = 256;

/** Sanitize deep link param: trim to max length, strip non-safe characters. */
function sanitize(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, MAX_PARAM_LENGTH).replace(/[^\w.-]/g, '');
}

/**
 * Captures Meta attribution params (fbclid + UTM) from the initial deep link URL.
 * Should be called once on first app open in _layout.tsx.
 * Skips if attribution was already captured on a previous launch.
 */
export async function captureMetaAttribution(): Promise<void> {
  try {
    const alreadyCaptured = await SecureStore.getItemAsync(STORE_KEYS.CAPTURED);
    if (alreadyCaptured) return;

    const url = await Linking.getInitialURL();
    if (!url) return;

    const parsed = new URL(url);

    // Capture fbclid for CAPI attribution (MOT-209)
    const fbclid = sanitize(
      parsed.searchParams.get('_fbclid') ?? parsed.searchParams.get('fbclid'),
    );
    if (fbclid) {
      await SecureStore.setItemAsync(STORE_KEYS.FBCLID, fbclid);
    }

    // Capture UTM params for PostHog segmentation (MOT-210)
    const utmContent = sanitize(parsed.searchParams.get('utm_content'));
    const utmSource = sanitize(parsed.searchParams.get('utm_source'));
    const utmCampaign = sanitize(parsed.searchParams.get('utm_campaign'));

    if (utmContent) {
      await SecureStore.setItemAsync(STORE_KEYS.UTM_CONTENT, utmContent);
      if (utmSource) await SecureStore.setItemAsync(STORE_KEYS.UTM_SOURCE, utmSource);
      if (utmCampaign) await SecureStore.setItemAsync(STORE_KEYS.UTM_CAMPAIGN, utmCampaign);

      // Set on anonymous PostHog session immediately
      if (posthogClient) {
        posthogClient.capture('$set', {
          $set: {
            utm_content: utmContent,
            utm_source: utmSource,
            utm_campaign: utmCampaign,
            first_seen_at: new Date().toISOString(),
          },
        });
      }
    }

    // Mark as captured so we skip on future launches
    await SecureStore.setItemAsync(STORE_KEYS.CAPTURED, '1');
  } catch {
    // Silently ignore — attribution is best-effort, don't crash the app
  }
}

/**
 * Returns stored UTM properties for carrying forward on posthog.identify().
 * Called during auth state change when a user signs in (MOT-211).
 */
export async function getStoredUtmProperties(): Promise<Record<string, string> | null> {
  try {
    const utmContent = await SecureStore.getItemAsync(STORE_KEYS.UTM_CONTENT);
    if (!utmContent) return null;

    const utmSource = await SecureStore.getItemAsync(STORE_KEYS.UTM_SOURCE);
    const utmCampaign = await SecureStore.getItemAsync(STORE_KEYS.UTM_CAMPAIGN);

    return {
      utm_content: utmContent,
      ...(utmSource && { utm_source: utmSource }),
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
