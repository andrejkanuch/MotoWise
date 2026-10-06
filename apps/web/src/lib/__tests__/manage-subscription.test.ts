import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import { resolveManageSubscription } from '../manage-subscription';

function info(managementURL: string | null, store?: string) {
  return {
    managementURL,
    entitlements: {
      active: store ? { [REVENUECAT_ENTITLEMENT_PRO]: { store } } : {},
    },
  };
}

describe('resolveManageSubscription', () => {
  it('links straight to a RevenueCat management URL when there is one', () => {
    expect(resolveManageSubscription(info('https://pay.rev.cat/manage', 'rc_billing'))).toEqual({
      status: 'web',
      url: 'https://pay.rev.cat/manage',
    });
  });

  it('gives a Stripe subscriber with a null management URL a portal path, not nothing', () => {
    // RevenueCat returns managementURL: null for Stripe-app subscriptions unless a
    // Stripe Customer Portal URL is configured on the RevenueCat Stripe app.
    expect(resolveManageSubscription(info(null, 'stripe'))).toEqual({ status: 'web_portal' });
    expect(resolveManageSubscription(info(null, 'rc_billing'))).toEqual({ status: 'web_portal' });
  });

  it('sends store subscribers and non-subscribers to the store guidance', () => {
    expect(resolveManageSubscription(info(null, 'app_store'))).toEqual({ status: 'store' });
    expect(resolveManageSubscription(info(null, 'play_store'))).toEqual({ status: 'store' });
    expect(resolveManageSubscription(info(null))).toEqual({ status: 'store' });
    expect(resolveManageSubscription(null)).toEqual({ status: 'store' });
  });
});
