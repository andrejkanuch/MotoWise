import { AppEventsLogger } from 'react-native-fbsdk-next';
import { isAnalyticsEnabled } from './analytics';

export const MetaAnalytics = {
  trackCompleteTutorial: () => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('fb_mobile_tutorial_completion');
  },

  trackViewContent: (contentType: string, contentId: string) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('fb_mobile_content_view', {
      fb_content_type: contentType,
      fb_content_id: contentId,
    });
  },

  trackSearch: (query: string) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('fb_mobile_search', {
      fb_search_string: query.slice(0, 256),
    });
  },

  trackAddToGarage: (make: string, model: string, year: number) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('fb_mobile_add_to_wishlist', {
      fb_content_type: 'motorcycle',
      fb_description: `${year} ${make} ${model}`,
    });
  },

  trackStartTrial: (offerId: string) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('StartTrial', {
      fb_content_id: offerId,
    });
  },

  trackSubscribe: (revenue: number, currency: string, packageId: string) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logPurchase(revenue, currency, {
      fb_content_id: packageId,
    });
  },

  trackStartDiagnostic: () => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('DiagnosticStarted', {
      fb_content_type: 'ai_diagnostic',
    });
  },

  trackLogRide: (distanceKm: number) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('RideLogged', {
      fb_content_type: 'ride',
      distance_km: distanceKm,
    });
  },

  trackLogMaintenance: (maintenanceType: string) => {
    if (!isAnalyticsEnabled()) return;
    AppEventsLogger.logEvent('MaintenanceLogged', {
      fb_content_type: 'maintenance',
      fb_description: maintenanceType,
    });
  },
};
