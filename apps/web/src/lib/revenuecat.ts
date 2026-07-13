import type { CustomerInfo } from '@revenuecat/purchases-js';

/**
 * Serializes all SDK access. The web `Purchases` singleton must be configured
 * exactly once, and `changeUser` must not overlap another config/re-key — but
 * this helper is shared by multiple hooks/pages that can mount together (e.g.
 * useProStatus + useManageSubscription on /profile) and enter concurrently.
 * Without a queue, two callers can both observe `isConfigured() === false` and
 * double-configure, or race a `changeUser`, handing the wrong user's info back.
 * Chaining every call through this promise runs config/re-key/read strictly in
 * order. A rejected call is caught here so it can't break the chain for the next.
 */
let queue: Promise<unknown> = Promise.resolve();

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

  const run = queue.then(() => resolveCustomerInfo(apiKey, appUserId));
  // Keep the chain alive regardless of this call's outcome.
  queue = run.catch(() => undefined);
  return run;
}

/** Perform one config/re-key/read cycle. Callers must funnel through the queue. */
async function resolveCustomerInfo(apiKey: string, appUserId: string): Promise<CustomerInfo> {
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
