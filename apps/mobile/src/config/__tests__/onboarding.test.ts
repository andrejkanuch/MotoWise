import {
  getFlowScreens,
  getNextRoute,
  getPreviousRoute,
  getResumeRoute,
  getStepIndex,
  getTotalScreens,
  getVisibleProgress,
  OB_ROUTE,
  OB_SCREEN,
  OB_STEP_NAME,
  OB_VARIANT,
  type ObVariant,
  ONBOARDING_FLOWS,
} from '../onboarding';

/**
 * `heard_about` is the load-bearing survivor of the 2026-08-24 onboarding cut: it
 * is the only working install-attribution signal this product has (66 of 85
 * riders answer it, and there is no MMP). These tests pin its placement so a
 * future flow edit cannot quietly drop it or move it out of the
 * account → heard-about → notifications sequence that the attribution analysis
 * depends on.
 *
 * The paywall step it used to follow is gone; heard-about now follows `account`
 * in every variant, since all variant values resolve to the one shipped flow.
 */
describe('heard-about (HDYHAU) flow placement', () => {
  const variants = [
    OB_VARIANT.SHIPPED,
    OB_VARIANT.LEAN,
    OB_VARIANT.INVESTED,
    OB_VARIANT.CONTROL,
  ] as const;

  it.each(variants)('sits directly after account, before notifications, in %s', (variant) => {
    const flow = ONBOARDING_FLOWS[variant];
    const heardIdx = flow.indexOf(OB_SCREEN.HEARD_ABOUT);
    const accountIdx = flow.indexOf(OB_SCREEN.ACCOUNT);
    const notificationsIdx = flow.indexOf(OB_SCREEN.NOTIFICATIONS);

    expect(heardIdx).toBe(accountIdx + 1);
    expect(notificationsIdx).toBe(heardIdx + 1);
  });

  it.each(variants)('no longer follows a paywall step in %s — there is none', (variant) => {
    expect(ONBOARDING_FLOWS[variant].indexOf(OB_SCREEN.PAYWALL)).toBe(-1);
  });

  it('routes account → heard-about → notifications in every variant', () => {
    for (const variant of variants) {
      expect(getNextRoute(variant, OB_SCREEN.ACCOUNT)).toBe(OB_ROUTE.HEARD_ABOUT);
      expect(getNextRoute(variant, OB_SCREEN.HEARD_ABOUT)).toBe(OB_ROUTE.NOTIFICATIONS);
    }
  });

  it('is not bike-dependent — never skipped when the rider has no bike', () => {
    for (const variant of variants) {
      expect(getNextRoute(variant, OB_SCREEN.ACCOUNT, { hasBike: false })).toBe(
        OB_ROUTE.HEARD_ABOUT,
      );
      expect(getNextRoute(variant, OB_SCREEN.HEARD_ABOUT, { hasBike: false })).toBe(
        OB_ROUTE.NOTIFICATIONS,
      );
    }
  });

  it('survives a resume from the retired paywall step', () => {
    // A rider mid-flow on the paywall when the OTA lands resolves forward to
    // account, which still leads to heard-about — so the attribution question is
    // asked even for riders caught by the cutover.
    for (const variant of variants) {
      expect(getNextRoute(variant, OB_SCREEN.PAYWALL, { hasBike: false })).toBe(OB_ROUTE.ACCOUNT);
    }
  });

  it('has a stable snake_case analytics step name and a valid index', () => {
    expect(OB_STEP_NAME[OB_SCREEN.HEARD_ABOUT]).toBe('heard_about');
    for (const variant of variants) {
      const idx = getStepIndex(variant, OB_SCREEN.HEARD_ABOUT);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(getTotalScreens(variant));
    }
  });
});

/**
 * The variant is persisted in MMKV and only typed as `ObVariant` on the way
 * back out, so the running bundle can be handed a value it has no flow for.
 * That happened on 2026-10-07: an install holding `garage_first` ran a 3.22.0
 * bundle, which predates that arm, and the welcome screen threw on its first
 * render — `getResumeRoute` → `flow.indexOf` of undefined — six times in a
 * row. (Sentry MOTO-VAULT-REACT-NATIVE-3P)
 */
describe('a persisted variant this bundle does not know', () => {
  // Stand-ins for "written by another bundle". The second is an own-prototype
  // key: a plain `ONBOARDING_FLOWS[variant] ?? fallback` would return a function.
  const unknownVariants = ['paywall_first_2027', 'constructor'].map(
    (value) => value as unknown as ObVariant,
  );
  const withBike = { hasBike: true };

  it.each(unknownVariants)('%s gets the paywall-free shipped flow', (variant) => {
    expect(getFlowScreens(variant)).toEqual(ONBOARDING_FLOWS[OB_VARIANT.SHIPPED]);
    expect(getFlowScreens(variant)).not.toContain(OB_SCREEN.PAYWALL);
    expect(getTotalScreens(variant)).toBe(getTotalScreens(OB_VARIANT.SHIPPED));
  });

  it.each(unknownVariants)('%s resumes after a kill instead of throwing', (variant) => {
    // The exact call the welcome screen makes on a cold start mid-onboarding.
    expect(getResumeRoute(variant, OB_SCREEN.BIKE_SETUP, withBike)).toBe(OB_ROUTE.REVEAL);
    expect(getNextRoute(variant, OB_SCREEN.ACCOUNT, withBike)).toBe(OB_ROUTE.HEARD_ABOUT);
  });

  it.each(unknownVariants)('%s keeps Back, step index and progress working', (variant) => {
    expect(getPreviousRoute(variant, OB_SCREEN.ACCOUNT, withBike)).toBe(OB_ROUTE.COMMITMENT);
    expect(getStepIndex(variant, OB_SCREEN.EXPERIENCE)).toBe(1);
    expect(getVisibleProgress(variant, OB_SCREEN.EXPERIENCE, withBike)).toEqual(
      getVisibleProgress(OB_VARIANT.SHIPPED, OB_SCREEN.EXPERIENCE, withBike),
    );
  });

  it('leaves both experiment arms on their own flows', () => {
    const garageFirst = getFlowScreens(OB_VARIANT.GARAGE_FIRST);
    const commitFirst = getFlowScreens(OB_VARIANT.COMMIT_FIRST);

    expect(garageFirst).toBe(ONBOARDING_FLOWS[OB_VARIANT.GARAGE_FIRST]);
    expect(garageFirst).not.toContain(OB_SCREEN.PAYWALL);
    expect(garageFirst).not.toContain(OB_SCREEN.COMMITMENT);
    expect(commitFirst).toBe(ONBOARDING_FLOWS[OB_VARIANT.COMMIT_FIRST]);
    expect(commitFirst.indexOf(OB_SCREEN.PAYWALL)).toBe(commitFirst.indexOf(OB_SCREEN.ACCOUNT) + 1);
  });
});
