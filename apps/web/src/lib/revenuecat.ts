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
 * How long a settled read is shared with later callers. Long enough to cover
 * hooks that mount a render or two apart (and React Strict Mode's re-run of
 * effects); short enough that a tab-refocus refresh still reads fresh data.
 */
const SHARED_READ_MS = 2_000;

interface SharedRead {
  appUserId: string;
  promise: Promise<CustomerInfo>;
  /** `null` while in flight. */
  settledAt: number | null;
}

let shared: SharedRead | null = null;

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

  // One read per burst: /garage mounts useProStatus twice (nav badge + account
  // section) and useManageSubscription once, and each used to queue its own
  // GET /v1/subscribers/<id>. Callers for the same user that arrive while a read
  // is in flight, or within SHARED_READ_MS of it settling, share its result.
  const now = Date.now();
  if (
    shared &&
    shared.appUserId === appUserId &&
    (shared.settledAt === null || now - shared.settledAt < SHARED_READ_MS)
  ) {
    return shared.promise;
  }

  const run = queue.then(() => resolveCustomerInfo(apiKey, appUserId));
  // Keep the chain alive regardless of this call's outcome.
  queue = run.catch(() => undefined);

  const entry: SharedRead = { appUserId, promise: run, settledAt: null };
  shared = entry;
  run.then(
    () => {
      entry.settledAt = Date.now();
    },
    () => {
      // Never reuse a failure: the next caller retries.
      if (shared === entry) shared = null;
    },
  );
  return run;
}

/** Test hook: forget the shared read. */
export function resetRevenueCatReadCacheForTests(): void {
  shared = null;
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
