import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import Constants from 'expo-constants';
import { useSubscriptionStore } from '../stores/subscription.store';
import { captureException } from './analytics';

// Module-level cached import — resolve once, reuse everywhere
let PurchasesModule: typeof import('react-native-purchases') | null = null;

async function getPurchases() {
  if (!PurchasesModule) {
    PurchasesModule = await import('react-native-purchases');
  }
  return PurchasesModule.default;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

// Shared init promise — loginRevenueCat awaits this before calling logIn
let initPromise: Promise<(() => void) | null> | null = null;

export function initRevenueCat(): Promise<(() => void) | null> {
  if (isExpoGo()) {
    return Promise.resolve(null);
  }
  if (!initPromise) {
    initPromise = doInit();
  }
  return initPromise;
}

function updateStoreFromCustomerInfo(info: {
  entitlements: { active: Record<string, { periodType?: string; expirationDate?: string | null }> };
}) {
  const store = useSubscriptionStore.getState();
  const isPro = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO] !== undefined;
  store.setPro(isPro);

  const proEntitlement = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO];
  if (proEntitlement?.periodType === 'TRIAL') {
    const expirationDate = proEntitlement.expirationDate;
    if (expirationDate) {
      const daysLeft = Math.ceil(
        (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      store.setTrialing(true, daysLeft);
    }
  } else {
    store.setTrialing(false);
  }
  store.setVerified(true);
}

async function doInit(): Promise<(() => void) | null> {
  try {
    const Purchases = await getPurchases();

    const apiKey =
      process.env.EXPO_OS === 'ios'
        ? process.env.EXPO_PUBLIC_RC_IOS_KEY
        : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

    if (!apiKey) {
      console.warn('[RevenueCat] No API key configured');
      return null;
    }

    await Purchases.configure({ apiKey });
    useSubscriptionStore.getState().setAvailable(true);

    // Set up listener — store the reference for cleanup
    const listener = (info: {
      entitlements: {
        active: Record<string, { periodType?: string; expirationDate?: string | null }>;
      };
    }) => {
      updateStoreFromCustomerInfo(info);
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    // Hydrate store with initial state
    const customerInfo = await Purchases.getCustomerInfo();
    updateStoreFromCustomerInfo(customerInfo);

    // Return cleanup function for useEffect
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  } catch (e) {
    console.error('[RevenueCat] Init failed:', e instanceof Error ? e.message : e);
    captureException(e);
    return null;
  }
}

export async function loginRevenueCat(userId: string) {
  if (isExpoGo()) return;
  // Wait for configure() to complete before calling logIn()
  const cleanup = await initRevenueCat();
  if (!cleanup) return;
  try {
    const Purchases = await getPurchases();
    await Purchases.logIn(userId);
    // Set PostHog user ID so the RevenueCat → PostHog integration can
    // match server-side subscription events to the correct PostHog user.
    await Purchases.setAttributes({ $posthogUserId: userId });
  } catch (e) {
    console.error('[RevenueCat] logIn failed:', e instanceof Error ? e.message : e);
    captureException(e);
  }
}

/**
 * Present the RevenueCat remote paywall.
 * Uses the paywall configured in the RevenueCat dashboard.
 *
 * By default uses `offerings.current` which is controlled by RevenueCat
 * Experiments — if an experiment is active, the user is automatically
 * assigned a variant and the correct offering is returned as `current`.
 *
 * @param options.requiredEntitlementIdentifier - Only show if user lacks this entitlement
 * @param options.offeringIdentifier - Force a specific offering (bypasses experiments)
 * @param options.placement - Use a RevenueCat Placement to serve the offering for this
 *   paywall location. Placements allow per-location A/B tests (e.g. "onboarding",
 *   "settings", "feature_gate"). Falls back to `offerings.current` if no placement
 *   is configured in the RC dashboard.
 * @returns 'purchased' | 'restored' | 'cancelled' | 'not_presented' | 'error'
 */
export async function presentPaywall(
  options: {
    requiredEntitlementIdentifier?: string;
    offeringIdentifier?: string;
    placement?: string;
  } = {},
): Promise<'purchased' | 'restored' | 'cancelled' | 'not_presented' | 'error'> {
  if (isExpoGo()) {
    console.warn('[RevenueCat] Paywall not available in Expo Go');
    return 'not_presented';
  }

  try {
    const Purchases = await getPurchases();
    const RevenueCatUI = await import('react-native-purchases-ui');
    const { PAYWALL_RESULT } = RevenueCatUI;

    const offerings = await Purchases.getOfferings();

    // Resolve the offering to present:
    // 1. Explicit offeringIdentifier (bypasses experiments — use for one-off products like health_report)
    // 2. Placement-based offering (for per-location A/B tests via RC dashboard)
    // 3. offerings.current (controlled by RC Experiments — default path)
    let offering: (typeof offerings)['current'] | undefined;
    if (options.offeringIdentifier) {
      offering = offerings.all[options.offeringIdentifier] ?? offerings.current ?? undefined;
    } else if (options.placement) {
      offering =
        (await Purchases.getCurrentOfferingForPlacement(options.placement)) ??
        offerings.current ??
        undefined;
    } else {
      offering = offerings.current ?? undefined;
    }

    const result = options.requiredEntitlementIdentifier
      ? await RevenueCatUI.default.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: options.requiredEntitlementIdentifier,
          offering,
        })
      : await RevenueCatUI.default.presentPaywall({ offering });

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
        return 'purchased';
      case PAYWALL_RESULT.RESTORED:
        return 'restored';
      case PAYWALL_RESULT.NOT_PRESENTED:
        return 'not_presented';
      case PAYWALL_RESULT.ERROR:
        return 'error';
      default:
        return 'cancelled';
    }
  } catch (e) {
    console.error('[RevenueCat] presentPaywall failed:', e instanceof Error ? e.message : e);
    captureException(e);
    return 'error';
  }
}

export async function logoutRevenueCat() {
  if (isExpoGo()) return;
  const cleanup = await initRevenueCat();
  if (!cleanup) return;
  try {
    const Purchases = await getPurchases();
    await Purchases.logOut();
  } catch (e) {
    console.error('[RevenueCat] logOut failed:', e instanceof Error ? e.message : e);
    captureException(e);
  }
}
