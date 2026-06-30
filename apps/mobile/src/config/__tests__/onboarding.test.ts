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

describe('heard-about (HDYHAU) flow placement', () => {
  const variants = [OB_VARIANT.CONTROL, OB_VARIANT.LEAN, OB_VARIANT.INVESTED] as const;

  it.each(variants)('includes heard-about after the paywall in the %s flow', (variant) => {
    const flow = ONBOARDING_FLOWS[variant];
    const heardIdx = flow.indexOf(OB_SCREEN.HEARD_ABOUT);
    const paywallIdx = flow.indexOf(OB_SCREEN.PAYWALL);
    const notificationsIdx = flow.indexOf(OB_SCREEN.NOTIFICATIONS);

    expect(heardIdx).toBeGreaterThan(paywallIdx);
    expect(notificationsIdx).toBe(heardIdx + 1);
  });

  it('sits after account creation in the lean/invested flows', () => {
    for (const variant of [OB_VARIANT.LEAN, OB_VARIANT.INVESTED] as const) {
      const flow = ONBOARDING_FLOWS[variant];
      expect(flow.indexOf(OB_SCREEN.HEARD_ABOUT)).toBe(flow.indexOf(OB_SCREEN.ACCOUNT) + 1);
    }
  });

  it('routes paywall/account → heard-about → notifications per variant', () => {
    // control has no account step; the paywall precedes heard-about directly.
    expect(getNextRoute(OB_VARIANT.CONTROL, OB_SCREEN.PAYWALL)).toBe(OB_ROUTE.HEARD_ABOUT);
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.ACCOUNT)).toBe(OB_ROUTE.HEARD_ABOUT);
    expect(getNextRoute(OB_VARIANT.INVESTED, OB_SCREEN.ACCOUNT)).toBe(OB_ROUTE.HEARD_ABOUT);

    for (const variant of variants) {
      expect(getNextRoute(variant, OB_SCREEN.HEARD_ABOUT)).toBe(OB_ROUTE.NOTIFICATIONS);
    }
  });

  it('is not bike-dependent — never skipped when the rider has no bike', () => {
    for (const variant of variants) {
      expect(getNextRoute(variant, OB_SCREEN.PAYWALL, { hasBike: false })).not.toBeNull();
      // heard-about always resolves forward to notifications regardless of bike state.
      expect(getNextRoute(variant, OB_SCREEN.HEARD_ABOUT, { hasBike: false })).toBe(
        OB_ROUTE.NOTIFICATIONS,
      );
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
