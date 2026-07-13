import type { CustomerInfo } from '@revenuecat/purchases-js';

/**
 * Configure (or re-key) the shared RevenueCat Web SDK for `appUserId` and return
 * the current customer info.
 *
 * Centralizes the config boilerplate that used to be copy-pasted across
 * use-pro-status, use-manage-subscription, and the checkout/success page: read
 * the web API key, dynamic-import the SDK, configure once, then read customer
 * info.
 *
 * The SDK's `Purchases` singleton lives for the lifetime of the tab. Sign-out on
 * web is an SPA navigation (`router.push('/login')`) with no full document
 * reload, so without re-keying, a logout+login in the same tab would leave the
 * SDK configured for the *previous* user and hand the next user their
 * CustomerInfo — including the Web Billing `managementURL` that links into a
 * Stripe billing portal. `changeUser` re-keys the singleton to the current user
 * to prevent that cross-account leak.
 *
 * Returns `null` when the web API key isn't configured (e.g. preview/dev without
 * RevenueCat). Throws on SDK/network failures — callers decide how to handle.
 */
export async function getRevenueCatCustomerInfo(appUserId: string): Promise<CustomerInfo | null> {
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_WEB_API_KEY;
  if (!apiKey) return null;

  const { Purchases } = await import('@revenuecat/purchases-js');

  if (!Purchases.isConfigured()) {
    Purchases.configure({ apiKey, appUserId });
    return Purchases.getSharedInstance().getCustomerInfo();
  }

  const instance = Purchases.getSharedInstance();
  if (instance.getAppUserId() !== appUserId) {
    // Re-key the singleton; changeUser resolves with the new user's info.
    return instance.changeUser(appUserId);
  }

  return instance.getCustomerInfo();
}
