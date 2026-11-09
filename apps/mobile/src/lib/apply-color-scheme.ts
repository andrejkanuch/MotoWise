import { Appearance } from 'react-native';
import {
  addDisconnectListener,
  type CarPlaySubscription,
  isHeadUnitConnected,
} from '../../modules/carplay/src';

/** What `Appearance.setColorScheme` takes: a forced scheme, or back to the system's. */
export type AppliedColorScheme = 'light' | 'dark' | 'unspecified';

/** Nothing forced — the state every launch starts in. */
const INITIAL: AppliedColorScheme = 'unspecified';

let applied: AppliedColorScheme = INITIAL;
let pending: AppliedColorScheme | null = null;
let disconnectSubscription: CarPlaySubscription | null = null;

/**
 * Forces the app's light/dark scheme (App settings → Theme) — the one place
 * that calls `Appearance.setColorScheme`.
 *
 * Why not straight through: React Native's `-[RCTAppearance setColorScheme:]`
 * walks every connected scene as a phone `UIWindowScene` and asks for its
 * `windows`. The CarPlay scene is a `CPTemplateApplicationScene`, which has no
 * `windows`, so the call throws and the app dies (Sentry
 * MOTO-VAULT-REACT-NATIVE-43, 3.26.0) — mid-ride, killing the recording. So:
 *
 * - while a head unit is connected the native call is never made; the choice
 *   is kept and applied once CarPlay disconnects;
 * - a value already applied is not applied again. The old caller re-ran on
 *   every render of the root layout (nativewind's `useColorScheme` hands out a
 *   new `setColorScheme` each render), i.e. on every navigation — including
 *   opening the ride summary after Stop on CarPlay.
 *
 * Because launches start at 'unspecified', a rider on the System theme never
 * makes the native call at all.
 */
export function applyColorScheme(scheme: AppliedColorScheme): void {
  if (isHeadUnitConnected()) {
    pending = scheme;
    waitForDisconnect();
    return;
  }
  pending = null;
  if (scheme === applied) return;
  Appearance.setColorScheme(scheme);
  applied = scheme;
}

function waitForDisconnect(): void {
  if (disconnectSubscription) return;
  disconnectSubscription = addDisconnectListener(() => {
    disconnectSubscription?.remove();
    disconnectSubscription = null;
    if (pending !== null) applyColorScheme(pending);
  });
}

/** Test seam: forget what was applied and any deferred choice. */
export function resetAppliedColorSchemeForTests(): void {
  applied = INITIAL;
  pending = null;
  disconnectSubscription?.remove();
  disconnectSubscription = null;
}
