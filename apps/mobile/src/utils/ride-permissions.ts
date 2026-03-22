import * as Location from 'expo-location';
import { rideStorage } from './ride-storage';

type PermissionLevel = 'full' | 'foreground_only' | 'denied';

const COOLDOWN_KEY = 'permissions.pre_prompt_dismissed_at';
const FOREGROUND_RIDE_COUNT_KEY = 'permissions.foreground_ride_count';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FOREGROUND_RIDES_BEFORE_REPROMPT = 3;

export async function checkAndRequestPermissions(): Promise<PermissionLevel> {
  const foreground = await Location.getForegroundPermissionsAsync();

  if (!foreground.granted) {
    if (shouldShowPrePrompt()) {
      // Caller should show a custom pre-prompt UI before calling this.
      // If they proceed, we request the system prompt.
    }

    const result = await Location.requestForegroundPermissionsAsync();
    if (!result.granted) return 'denied';
  }

  const background = await Location.getBackgroundPermissionsAsync();
  if (!background.granted) {
    const bgResult = await Location.requestBackgroundPermissionsAsync();
    if (!bgResult.granted) {
      return 'foreground_only';
    }
  }

  return 'full';
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
  rideStorage.delete(FOREGROUND_RIDE_COUNT_KEY);
}
