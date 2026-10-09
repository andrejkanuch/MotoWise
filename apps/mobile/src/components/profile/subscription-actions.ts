import { REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import type { TFunction } from 'i18next';
import { Alert, Linking } from 'react-native';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { updateStoreFromCustomerInfo } from '../../lib/subscription';

/** Lazy RevenueCat import, with the require fallback Jest needs. */
async function getPurchases() {
  try {
    return (await import('react-native-purchases')).default;
  } catch {
    return (require('react-native-purchases') as typeof import('react-native-purchases')).default;
  }
}

/**
 * Open the store's own subscription management page for the signed-in rider
 * (App Store, Play, or RevenueCat Web Billing — RevenueCat picks the URL).
 * A lifetime purchase or promo grant has no URL; the rider is told so.
 */
export async function openManageSubscription(t: TFunction): Promise<void> {
  try {
    const Purchases = await getPurchases();
    const info = await Purchases.getCustomerInfo();
    if (info.managementURL) {
      await Linking.openURL(info.managementURL);
      return;
    }
    Alert.alert(t('profile.manageUnavailableTitle'), t('profile.manageUnavailableBody'));
  } catch (e) {
    captureException(e, { source: 'profile.manageSubscription' });
    Alert.alert(t('profile.storeErrorTitle'), t('profile.storeErrorBody'));
  }
}

/**
 * Restore store purchases for this account and refresh the Pro state from the
 * result, telling the rider whether Pro came back.
 */
export async function restorePurchases(t: TFunction): Promise<void> {
  try {
    const Purchases = await getPurchases();
    const info = await Purchases.restorePurchases();
    updateStoreFromCustomerInfo(info);
    const restored = info.entitlements.active[REVENUECAT_ENTITLEMENT_PRO] !== undefined;
    if (restored) trackEvent(AnalyticsEvent.SUBSCRIPTION_RESTORED, { surface: 'profile_restore' });
    Alert.alert(
      restored ? t('profile.restoreSuccessTitle') : t('profile.restoreNoneTitle'),
      restored ? t('profile.restoreSuccessBody') : t('profile.restoreNoneBody'),
    );
  } catch (e) {
    captureException(e, { source: 'profile.restorePurchases' });
    Alert.alert(t('profile.storeErrorTitle'), t('profile.storeErrorBody'));
  }
}
