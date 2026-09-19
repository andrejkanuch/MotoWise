// MOT-265: updateStoreFromCustomerInfo is the SOLE source of isPro / isTrialing /
// trialDaysLeft (drives every pro-gate). Tested against the REAL subscription
// store (only analytics is mocked, to avoid pulling native Sentry/PostHog).

jest.mock('../analytics', () => require('../../test/mocks').mockAnalytics());

import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { hasUsedTrial, updateStoreFromCustomerInfo } from '../subscription';

const PRO = REVENUECAT_ENTITLEMENT_PRO;

beforeEach(() => {
  useSubscriptionStore.setState({
    isPro: false,
    isTrialing: false,
    trialDaysLeft: null,
    isVerified: false,
  });
});

describe('updateStoreFromCustomerInfo', () => {
  it('sets isPro + isVerified for an active non-trial pro entitlement', () => {
    updateStoreFromCustomerInfo({ entitlements: { active: { [PRO]: { periodType: 'NORMAL' } } } });

    const s = useSubscriptionStore.getState();
    expect(s.isPro).toBe(true);
    expect(s.isTrialing).toBe(false);
    expect(s.isVerified).toBe(true);
  });

  it('computes trialDaysLeft + isTrialing for a TRIAL entitlement with expiration', () => {
    const expirationDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    updateStoreFromCustomerInfo({
      entitlements: { active: { [PRO]: { periodType: 'TRIAL', expirationDate } } },
    });

    const s = useSubscriptionStore.getState();
    expect(s.isPro).toBe(true);
    expect(s.isTrialing).toBe(true);
    expect(s.trialDaysLeft).toBe(5);
  });

  it('does not flag trialing when a TRIAL entitlement is missing expirationDate', () => {
    updateStoreFromCustomerInfo({ entitlements: { active: { [PRO]: { periodType: 'TRIAL' } } } });

    const s = useSubscriptionStore.getState();
    expect(s.isPro).toBe(true);
    expect(s.isTrialing).toBe(false);
    expect(s.trialDaysLeft).toBeNull();
  });

  it('clears pro/trial but marks verified when no entitlement is active', () => {
    useSubscriptionStore.setState({ isPro: true, isTrialing: true, trialDaysLeft: 3 });

    updateStoreFromCustomerInfo({ entitlements: { active: {} } });

    const s = useSubscriptionStore.getState();
    expect(s.isPro).toBe(false);
    expect(s.isTrialing).toBe(false);
    expect(s.isVerified).toBe(true);
  });
});

// One trial per person, cross-store: the client stamps has_had_trial from the
// latest Pro period so Targeting can serve the no-trial offering even before the
// webhook has, or when the receipt came from another store account.
describe('hasUsedTrial', () => {
  it('is true when the latest Pro period is a trial (active or expired)', () => {
    expect(hasUsedTrial({ entitlements: { all: { [PRO]: { periodType: 'TRIAL' } } } })).toBe(true);
  });

  it('is false for a paying (NORMAL) period — a converted trialer is a customer', () => {
    expect(hasUsedTrial({ entitlements: { all: { [PRO]: { periodType: 'NORMAL' } } } })).toBe(
      false,
    );
  });

  it('is false when the account never held Pro', () => {
    expect(hasUsedTrial({ entitlements: { all: {} } })).toBe(false);
  });
});
