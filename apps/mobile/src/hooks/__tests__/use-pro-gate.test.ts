import { FREE_TIER_LIMITS } from '@motovault/types';

// checkFeatureAccess is pure (only needs FREE_TIER_LIMITS). Stub the sibling
// imports so importing the hook module doesn't pull in the native paywall /
// analytics (react-native-fbsdk-next) chain under jest.
jest.mock('../../lib/subscription', () => ({ presentPaywall: jest.fn() }));
jest.mock('../../stores/subscription.store', () => ({
  useSubscriptionStore: (selector: (s: { isPro: boolean; isTrialing: boolean }) => unknown) =>
    selector({ isPro: false, isTrialing: false }),
}));

import { renderHook } from '@testing-library/react-native';
import { presentPaywall } from '../../lib/subscription';
import { checkFeatureAccess, useProGate } from '../use-pro-gate';

describe('checkFeatureAccess', () => {
  it('grants unlimited access to Pro users regardless of count', () => {
    expect(checkFeatureAccess('MAX_BIKES', 999, true)).toEqual({
      allowed: true,
      unlimited: true,
    });
  });

  it('allows a free user below the limit and reports remaining', () => {
    const belowLimit = FREE_TIER_LIMITS.MAX_BIKES - 1;
    const access = checkFeatureAccess('MAX_BIKES', belowLimit, false);
    expect(access).toEqual({
      allowed: true,
      unlimited: false,
      limit: FREE_TIER_LIMITS.MAX_BIKES,
      remaining: FREE_TIER_LIMITS.MAX_BIKES - belowLimit,
    });
  });

  it('blocks a free user exactly at the limit (allowed = count < limit)', () => {
    const access = checkFeatureAccess('MAX_BIKES', FREE_TIER_LIMITS.MAX_BIKES, false);
    expect(access.allowed).toBe(false);
    expect(access).toMatchObject({ unlimited: false, remaining: 0 });
  });

  it('blocks a free user over the limit and clamps remaining at 0', () => {
    const access = checkFeatureAccess('MAX_BIKES', FREE_TIER_LIMITS.MAX_BIKES + 5, false);
    expect(access.allowed).toBe(false);
    expect(access).toMatchObject({ remaining: 0 });
  });

  it('handles a single-use limit (MAX_AI_DIAGNOSTICS_PER_MONTH = 1)', () => {
    expect(checkFeatureAccess('MAX_AI_DIAGNOSTICS_PER_MONTH', 0, false).allowed).toBe(true);
    expect(checkFeatureAccess('MAX_AI_DIAGNOSTICS_PER_MONTH', 1, false).allowed).toBe(false);
  });
});

describe('requireAccess', () => {
  // Issue 365 T05a: call-site context rides on the one paywall request instead of
  // a second paywall_present_requested fired next to the gate.
  it('adds call-site paywall metadata without overriding the limit fields', async () => {
    const { result } = await renderHook(() => useProGate());
    const used = FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH;

    expect(
      result.current.requireAccess('MAX_RECEIPT_SCANS_PER_MONTH', used, {
        entry_surface: 'home',
        limit_key: 'overridden',
      }),
    ).toBe(false);

    expect(presentPaywall).toHaveBeenCalledTimes(1);
    expect(jest.mocked(presentPaywall).mock.calls[0][0]).toMatchObject({
      feature: 'unlimited_scans',
      surface: 'use_pro_gate',
      metadata: {
        entry_surface: 'home',
        limit_key: 'MAX_RECEIPT_SCANS_PER_MONTH',
        current_count: used,
      },
    });
  });
});
