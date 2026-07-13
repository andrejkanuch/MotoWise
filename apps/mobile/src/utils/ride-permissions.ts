import * as Location from 'expo-location';
import { captureException } from '../lib/analytics';
import { rideStorage } from './ride-storage';

type PermissionLevel = 'full' | 'foreground_only' | 'denied';

const COOLDOWN_KEY = 'permissions.pre_prompt_dismissed_at';
const FOREGROUND_RIDE_COUNT_KEY = 'permissions.foreground_ride_count';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FOREGROUND_RIDES_BEFORE_REPROMPT = 3;

export async function checkAndRequestPermissions(): Promise<PermissionLevel> {
  const foreground = await Location.getForegroundPermissionsAsync();

  if (!foreground.granted) {
    // The caller (Start Ride flow) shows the prominent-disclosure modal before
    // reaching here — see LocationDisclosureModal + hasAllLocationPermissions.
    const result = await Location.requestForegroundPermissionsAsync();
    if (!result.granted) return 'denied';
  }

  // Background-location APIs can THROW (not just resolve un-granted) on some
  // Android builds/OS versions — e.g. "You need to add ACCESS_BACKGROUND_LOCATION
  // to the AndroidManifest" (MOTO-VAULT-REACT-NATIVE-19). A ride is perfectly
  // usable with foreground-only tracking, so degrade gracefully instead of
  // crashing the start-ride flow.
  try {
    const background = await Location.getBackgroundPermissionsAsync();
    if (!background.granted) {
      const bgResult = await Location.requestBackgroundPermissionsAsync();
      if (!bgResult.granted) {
        return 'foreground_only';
      }
    }
  } catch (err) {
    captureException(err, { source: 'ride-permissions.backgroundLocation' });
    return 'foreground_only';
  }

  return 'full';
}

/**
 * True only when BOTH foreground and background location are already granted, so
 * the prominent disclosure can be skipped and the ride started directly.
 *
 * Used to gate the Google Play prominent-disclosure modal (Play policy requires
 * explaining background collection BEFORE any location access; Expo's own docs
 * say to explain before `requestBackgroundPermissionsAsync`, which on Android 11+
 * silently sends the user to system Settings). A background read that THROWS
 * (see the note in `checkAndRequestPermissions`) counts as not-granted so the
 * disclosure is shown rather than the Settings redirect firing unexplained.
 */
export async function hasAllLocationPermissions(): Promise<boolean> {
  // Both status reads sit inside the try: a rejected foreground read (like the
  // background one) must count as not-granted so it never bubbles out of
  // handleStartRide — the disclosure is shown rather than the flow crashing.
  try {
    const foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted) return false;

    const background = await Location.getBackgroundPermissionsAsync();
    return background.granted;
  } catch {
    return false;
  }
}

export function shouldShowPrePrompt(): boolean {
  const dismissedAt = rideStorage.getNumber(COOLDOWN_KEY);
  if (dismissedAt) {
    const elapsed = Date.now() - dismissedAt;
    if (elapsed < COOLDOWN_MS) return false;
  }
  return true;
}

export function shouldShowForegroundReprompt(): boolean {
  const count = rideStorage.getNumber(FOREGROUND_RIDE_COUNT_KEY) ?? 0;
  return count >= FOREGROUND_RIDES_BEFORE_REPROMPT;
}

export function markPrePromptDismissed(): void {
  rideStorage.set(COOLDOWN_KEY, Date.now());
}

export function incrementForegroundRideCount(): void {
  const count = rideStorage.getNumber(FOREGROUND_RIDE_COUNT_KEY) ?? 0;
  rideStorage.set(FOREGROUND_RIDE_COUNT_KEY, count + 1);
}

export function resetForegroundRideCount(): void {
  rideStorage.remove(FOREGROUND_RIDE_COUNT_KEY);
}
