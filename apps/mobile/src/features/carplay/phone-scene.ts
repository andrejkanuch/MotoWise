// Pure seed for usePhoneSceneVisible (use-carplay.ts), split out so it is testable
// without the hook's data dependencies.

/**
 * Best guess before the library reports the phone scene. Without the library (Android,
 * a build without the pod) the phone UI is the only UI, so it counts as visible —
 * behavior there is unchanged. With it, an active app with no head unit attached can
 * only be the phone UI; that fallback keeps phone-only launches working even if the
 * library never reports the scene. A CarPlay-only launch starts hidden.
 */
export function initialPhoneSceneVisible(input: {
  carPlayAvailable: boolean;
  appActive: boolean;
  headUnitConnected: boolean;
}): boolean {
  if (!input.carPlayAvailable) return true;
  return input.appActive && !input.headUnitConnected;
}
