import { Appearance } from 'react-native';
import {
  addDisconnectListener,
  addPhoneSceneVisibilityListener,
  type CarPlaySubscription,
  isHeadUnitConnected,
} from '../../modules/carplay/src';

/** What `Appearance.setColorScheme` takes: a forced scheme, or back to the system's. */
export type AppliedColorScheme = 'light' | 'dark' | 'unspecified';

/** Nothing forced — the state every launch starts in. */
const INITIAL: AppliedColorScheme = 'unspecified';

/** The rider's latest choice. */
let desired: AppliedColorScheme = INITIAL;
/** What native was last told. */
let applied: AppliedColorScheme = INITIAL;
let disconnectSubscription: CarPlaySubscription | null = null;
let phoneSceneSubscription: CarPlaySubscription | null = null;

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
 *   is applied once CarPlay disconnects;
 * - a value already applied is not applied again. The old caller re-ran on
 *   every render of the root layout (nativewind's `useColorScheme` hands out a
 *   new `setColorScheme` each render), i.e. on every navigation — including
 *   opening the ride summary after Stop on CarPlay;
 * - except when the phone UI (re)appears: native only themes the windows that
 *   exist at call time, and the CarPlay library creates a new phone window each
 *   time the phone scene connects (a CarPlay-first launch, or the phone UI
 *   swiped away while CarPlay kept the app alive). A forced Light/Dark is
 *   re-issued for it.
 *
 * Because launches start at 'unspecified', a rider on the System theme never
 * makes the native call at all.
 */
export function applyColorScheme(scheme: AppliedColorScheme): void {
  desired = scheme;
  watchPhoneScene();
  applyDesired(false);
}

function applyDesired(newWindow: boolean): void {
  if (isHeadUnitConnected()) {
    waitForDisconnect();
    return;
  }
  // Nothing was ever forced: a new window already follows the system.
  if (newWindow && desired === INITIAL && applied === INITIAL) return;
  if (!newWindow && desired === applied) return;
  Appearance.setColorScheme(desired);
  applied = desired;
}

function waitForDisconnect(): void {
  if (disconnectSubscription) return;
  disconnectSubscription = addDisconnectListener(() => {
    disconnectSubscription?.remove();
    disconnectSubscription = null;
    applyDesired(false);
  });
}

function watchPhoneScene(): void {
  if (phoneSceneSubscription) return;
  phoneSceneSubscription = addPhoneSceneVisibilityListener((visible) => {
    if (visible) applyDesired(true);
  });
}

/** Test seam: forget what was applied, the choice, and every subscription. */
export function resetAppliedColorSchemeForTests(): void {
  desired = INITIAL;
  applied = INITIAL;
  disconnectSubscription?.remove();
  disconnectSubscription = null;
  phoneSceneSubscription?.remove();
  phoneSceneSubscription = null;
}
