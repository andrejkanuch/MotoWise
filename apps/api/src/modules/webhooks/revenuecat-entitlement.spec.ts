import { describe, expect, it } from 'vitest';
import { type RcSubscriberResponse, resolveProEntitlement } from './revenuecat-entitlement';

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const PAST = '2026-10-01T00:00:00.000Z';
const FUTURE = '2026-11-06T12:00:00.000Z';
const PRO = 'MotoWise Pro';
const MONTHLY = 'motovault_pro_monthly_v4';
const LIFETIME = 'motovault_lifetime_v4';

const resolve = (body: RcSubscriberResponse, sandboxAllowed = false) =>
  resolveProEntitlement(body, { nowMs: NOW, sandboxAllowed });

const withEntitlement = (
  entitlement: Record<string, unknown>,
  extra: Partial<NonNullable<RcSubscriberResponse['subscriber']>> = {},
): RcSubscriberResponse => ({
  subscriber: { entitlements: { [PRO]: entitlement }, ...extra },
});

describe('resolveProEntitlement', () => {
  it('lifetime: entitlement with no expiry → pro/active, NULL expiry', () => {
    expect(
      resolve(
        withEntitlement(
          { expires_date: null, product_identifier: LIFETIME },
          { non_subscriptions: { [LIFETIME]: [{ is_sandbox: false, store: 'app_store' }] } },
        ),
      ),
    ).toEqual({
      resolved: true,
      state: {
        tier: 'pro',
        status: 'active',
        expiresAt: null,
        productId: LIFETIME,
        periodType: null,
        store: 'APP_STORE',
      },
    });
  });

  it('lifetime wins over an expired old subscription (RC points the entitlement at lifetime)', () => {
    const result = resolve(
      withEntitlement(
        { expires_date: null, product_identifier: LIFETIME },
        {
          subscriptions: {
            [MONTHLY]: { expires_date: PAST, unsubscribe_detected_at: PAST, is_sandbox: false },
          },
          non_subscriptions: { [LIFETIME]: [{ is_sandbox: false }] },
        },
      ),
    );
    expect(result).toMatchObject({ resolved: true, state: { tier: 'pro', expiresAt: null } });
  });

  it('no entitlement (never bought, or a refunded lifetime purchase) → free/expired', () => {
    expect(resolve({ subscriber: { entitlements: {} } })).toMatchObject({
      resolved: true,
      state: { tier: 'free', status: 'expired', expiresAt: null },
    });
    expect(resolve({ subscriber: {} })).toMatchObject({
      resolved: true,
      state: { tier: 'free', status: 'expired' },
    });
  });

  it('refunded lifetime still listed in non_subscriptions → free/expired (not a missing entitlement)', () => {
    expect(
      resolve({
        subscriber: {
          entitlements: {},
          non_subscriptions: { [LIFETIME]: [{ is_sandbox: false }] },
          subscriptions: {
            [MONTHLY]: { expires_date: PAST },
            refunded_annual: { expires_date: FUTURE, refunded_at: PAST },
          },
        },
      }),
    ).toMatchObject({ resolved: true, state: { tier: 'free', status: 'expired' } });
  });

  describe('missing "MotoWise Pro" entitlement while the subscriber has purchases (renamed)', () => {
    it('other entitlements present → unresolved missing_entitlement with product ids', () => {
      expect(
        resolve({
          subscriber: {
            entitlements: { 'MotoVault Pro': { expires_date: null, product_identifier: LIFETIME } },
            non_subscriptions: { [LIFETIME]: [{ is_sandbox: false }] },
          },
        }),
      ).toEqual({
        resolved: false,
        failure: 'missing_entitlement',
        reason: expect.stringContaining('MotoVault Pro'),
        productIds: [LIFETIME],
      });
    });

    it.each([
      ['an unexpired subscription', { expires_date: FUTURE }],
      ['a subscription with no expiry', { expires_date: null }],
    ])('no entitlements but %s → unresolved missing_entitlement', (_l, subscription) => {
      expect(
        resolve({ subscriber: { entitlements: {}, subscriptions: { [MONTHLY]: subscription } } }),
      ).toMatchObject({
        resolved: false,
        failure: 'missing_entitlement',
        reason: expect.stringContaining('live subscription'),
        productIds: [MONTHLY],
      });
    });
  });

  it('refunded or expired subscription: expiry in the past → free/expired with that expiry', () => {
    expect(
      resolve(
        withEntitlement(
          { expires_date: PAST, product_identifier: MONTHLY },
          { subscriptions: { [MONTHLY]: { period_type: 'normal', store: 'play_store' } } },
        ),
      ),
    ).toMatchObject({
      resolved: true,
      state: { tier: 'free', status: 'expired', expiresAt: PAST, store: 'PLAY_STORE' },
    });
  });

  it.each([
    ['active', { period_type: 'normal' }],
    ['trialing', { period_type: 'trial' }],
    ['cancelled', { period_type: 'normal', unsubscribe_detected_at: PAST }],
    ['cancelled', { period_type: 'trial', unsubscribe_detected_at: PAST }],
    ['past_due', { period_type: 'normal', billing_issues_detected_at: PAST }],
  ])('live subscription → pro/%s until expiry', (status, subscription) => {
    expect(
      resolve(
        withEntitlement(
          { expires_date: FUTURE, product_identifier: MONTHLY },
          { subscriptions: { [MONTHLY]: subscription } },
        ),
      ),
    ).toMatchObject({ resolved: true, state: { tier: 'pro', status, expiresAt: FUTURE } });
  });

  it('billing grace period: expired subscription still in grace → pro/past_due until grace end', () => {
    expect(
      resolve(
        withEntitlement(
          { expires_date: PAST, grace_period_expires_date: FUTURE, product_identifier: MONTHLY },
          { subscriptions: { [MONTHLY]: { billing_issues_detected_at: PAST } } },
        ),
      ),
    ).toMatchObject({
      resolved: true,
      state: { tier: 'pro', status: 'past_due', expiresAt: FUTURE },
    });
  });

  it('promotional / product-less entitlement with an expiry → pro/active', () => {
    expect(resolve(withEntitlement({ expires_date: FUTURE }))).toMatchObject({
      resolved: true,
      state: { tier: 'pro', status: 'active', expiresAt: FUTURE, productId: null },
    });
  });

  describe('sandbox', () => {
    const sandboxSub = withEntitlement(
      { expires_date: FUTURE, product_identifier: MONTHLY },
      { subscriptions: { [MONTHLY]: { is_sandbox: true } } },
    );
    const sandboxLifetime = withEntitlement(
      { expires_date: null, product_identifier: 'lifetime' },
      { non_subscriptions: { lifetime: [{ is_sandbox: true, store: 'test_store' }] } },
    );

    it.each([
      ['subscription', sandboxSub],
      ['lifetime', sandboxLifetime],
    ])('a sandbox-backed %s entitlement is NOT trusted for a non-allowlisted user', (_l, body) => {
      expect(resolve(body)).toMatchObject({ resolved: false });
    });

    it('is trusted for an allowlisted user', () => {
      expect(resolve(sandboxLifetime, true)).toMatchObject({
        resolved: true,
        state: { tier: 'pro', expiresAt: null },
      });
    });
  });

  it('unresolved when the response has no subscriber or an unparseable expiry', () => {
    expect(resolve({})).toMatchObject({ resolved: false });
    expect(resolve(withEntitlement({ expires_date: 'not-a-date' }))).toMatchObject({
      resolved: false,
    });
  });
});
