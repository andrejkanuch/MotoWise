import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DELETED_ROUTE_SCREENS, OB_SCREEN, type OnboardingRoute } from '../config/onboarding';

/**
 * Keeps the screen taxonomy honest against the filesystem.
 *
 * `OB_SCREEN` deliberately outlives its route files: retired screens stay as
 * identifiers so historical PostHog events remain readable and
 * `RETIRED_SCREEN_SUCCESSOR` can resolve a persisted `lastCompletedScreen`
 * forward. But `OnboardingRoutePath` is a template literal over those same
 * identifiers, and Expo Router's typed-route union only contains routes that
 * exist on disk. Delete a screen's file without adding it to
 * `DELETED_ROUTE_SCREENS` and `routeForScreen` silently starts producing an href
 * Expo Router does not recognize.
 *
 * That failure is invisible in CI: `.expo/` is gitignored, so CI has no
 * generated `router.d.ts` and typechecks against a union that is not the real
 * one. It only surfaces after someone runs the app locally. This test closes
 * that gap by checking the files directly, which CI can do.
 */
const ROUTE_DIR = join(__dirname, '..', 'app', '(onboarding)');

const hasRouteFile = (screen: OnboardingRoute): boolean =>
  existsSync(join(ROUTE_DIR, `${screen}.tsx`));

describe('onboarding screen taxonomy vs route files', () => {
  it('every screen NOT in DELETED_ROUTE_SCREENS has a route file', () => {
    const deleted = new Set<string>(DELETED_ROUTE_SCREENS);
    const missing = Object.values(OB_SCREEN)
      .filter((s) => !deleted.has(s))
      .filter((s) => !hasRouteFile(s));
    expect(missing).toEqual([]);
  });

  it('every screen in DELETED_ROUTE_SCREENS really has no route file', () => {
    // The inverse guard: if a file comes BACK, the exclusion is stale and the
    // screen should become navigable again rather than being resolved forward.
    const resurrected = DELETED_ROUTE_SCREENS.filter(hasRouteFile);
    expect(resurrected).toEqual([]);
  });
});
