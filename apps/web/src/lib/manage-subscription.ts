import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import type { CustomerInfo } from '@revenuecat/purchases-js';

/**
 * How the current user can manage (and cancel) their subscription.
 *
 * - `loading` — still resolving; render nothing rather than a wrong option.
 * - `web` — RevenueCat gave us a management URL (Web Billing, or Stripe with a
 *   portal URL configured on the RevenueCat Stripe app): link straight to it.
 * - `web_portal` — a web (Stripe / RevenueCat Billing) subscriber with NO
 *   management URL. RevenueCat returns `managementURL: null` for Stripe-app
 *   subscriptions unless a Stripe Customer Portal URL is set in the RevenueCat
 *   dashboard, which left web subscribers with no in-app way to cancel. The UI
 *   asks the API for a Stripe portal session instead, with a support fallback.
 * - `store` — App Store / Google Play (or nothing active): manage in the store.
 */
export type ManageSubscription =
  | { status: 'loading' }
  | { status: 'web'; url: string }
  | { status: 'web_portal' }
  | { status: 'store' };

export const SUPPORT_EMAIL = 'support@motovault.app';

/** RevenueCat stores whose subscriptions are billed through our own Stripe account. */
export const WEB_BILLING_STORES: ReadonlySet<string> = new Set(['stripe', 'rc_billing']);

/**
 * A portal URL is only ever navigated to when it is an absolute https URL. It
 * comes from our API, but `location.assign` would run a `javascript:` URL, so the
 * client never trusts the shape. The host is not pinned: Stripe lets the portal
 * run on a custom domain.
 */
export function isSafePortalUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

type ManagementInfo = Pick<CustomerInfo, 'managementURL'> & {
  entitlements: { active: Record<string, { store: string } | undefined> };
};

export function resolveManageSubscription(info: ManagementInfo | null): ManageSubscription {
  if (!info) return { status: 'store' };
  if (info.managementURL) return { status: 'web', url: info.managementURL };
  const store = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO]?.store;
  return store && WEB_BILLING_STORES.has(store) ? { status: 'web_portal' } : { status: 'store' };
}
