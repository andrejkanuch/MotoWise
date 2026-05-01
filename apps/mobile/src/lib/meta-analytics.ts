import { AppEventsLogger } from 'react-native-fbsdk-next';

export const MetaAnalytics = {
  trackCompleteRegistration: (eventId?: string) => {
    if (eventId) {
      AppEventsLogger.logEvent('fb_mobile_complete_registration', { event_id: eventId });
    } else {
      AppEventsLogger.logEvent('fb_mobile_complete_registration');
    }
  },

  trackViewContent: (contentType: string, contentId: string) =>
    AppEventsLogger.logEvent('fb_mobile_content_view', {
      fb_content_type: contentType,
      fb_content_id: contentId,
    }),

  trackSearch: (query: string) =>
    AppEventsLogger.logEvent('fb_mobile_search', {
      fb_search_string: query,
    }),

  trackAddToGarage: (make: string, model: string, year: number) =>
    AppEventsLogger.logEvent('fb_mobile_add_to_wishlist', {
      fb_content_type: 'motorcycle',
      fb_description: `${year} ${make} ${model}`,
    }),

  trackStartTrial: (offerId: string) =>
    AppEventsLogger.logEvent('fb_mobile_activate_app', {
      fb_content_id: offerId,
    }),

  trackSubscribe: (revenue: number, currency: string, packageId: string) =>
    AppEventsLogger.logPurchase(revenue, currency, {
      fb_content_id: packageId,
    }),

  trackStartDiagnostic: () =>
    AppEventsLogger.logEvent('fb_mobile_rate', {
      fb_content_type: 'ai_diagnostic',
    }),

  trackLogRide: () =>
    AppEventsLogger.logEvent('fb_mobile_achievement_unlocked', {
      fb_description: 'ride_logged',
      fb_content_type: 'ride',
    }),

  trackLogMaintenance: (maintenanceType: string) =>
    AppEventsLogger.logEvent('fb_mobile_spent_credits', {
      fb_content_type: 'maintenance',
      fb_description: maintenanceType,
    }),
};
