import Constants from 'expo-constants';
import { useSubscriptionStore } from '../stores/subscription.store';

let isConfigured = false;

export async function initRevenueCat() {
  if (isConfigured) return;

  // Skip in Expo Go — RevenueCat requires native modules
  if (Constants.appOwnership === 'expo') {
    console.warn('[RevenueCat] Skipping init — running in Expo Go');
    return;
  }

  try {
    const { default: Purchases } = await import('react-native-purchases');

    const apiKey =
      process.env.EXPO_OS === 'ios'
        ? process.env.EXPO_PUBLIC_RC_IOS_KEY
        : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

    if (!apiKey) {
      console.warn('[RevenueCat] No API key configured');
      return;
    }

    await Purchases.configure({ apiKey });
    isConfigured = true;
    useSubscriptionStore.getState().setAvailable(true);

    // Listen for subscription changes
    Purchases.addCustomerInfoUpdateListener((info) => {
      const store = useSubscriptionStore.getState();
      const isPro = info.entitlements.active.pro !== undefined;
      store.setPro(isPro);

      const proEntitlement = info.entitlements.active.pro;
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
    });
  } catch (e) {
    console.error('[RevenueCat] Init failed — subscriptions will be unavailable:', e);
  }
}
