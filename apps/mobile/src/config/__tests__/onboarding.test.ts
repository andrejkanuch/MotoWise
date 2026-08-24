import {
  getNextRoute,
  getStepIndex,
  getTotalScreens,
  OB_ROUTE,
  OB_SCREEN,
  OB_STEP_NAME,
  OB_VARIANT,
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
