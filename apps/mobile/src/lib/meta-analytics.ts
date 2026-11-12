import { AppEventsLogger } from 'react-native-fbsdk-next';
import { vendorSdksDisabled } from './e2e-build';

type EventsLogger = Pick<typeof AppEventsLogger, 'logEvent' | 'logPurchase'>;

const NOOP_EVENTS_LOGGER: EventsLogger = { logEvent: () => {}, logPurchase: () => {} };

// E2E builds keep the SDK initialised (Settings.initializeSDK runs on every launch) but send no events.
const eventsLogger: EventsLogger = vendorSdksDisabled() ? NOOP_EVENTS_LOGGER : AppEventsLogger;

export const MetaAnalytics = {
  trackCompleteRegistration: (eventId?: string) => {
    if (eventId) {
      eventsLogger.logEvent('fb_mobile_complete_registration', { event_id: eventId });
    } else {
      eventsLogger.logEvent('fb_mobile_complete_registration');
    }
  },

  trackViewContent: (contentType: string, contentId: string) =>
    eventsLogger.logEvent('fb_mobile_content_view', {
      fb_content_type: contentType,
      fb_content_id: contentId,
    }),

  trackSearch: (query: string) =>
    eventsLogger.logEvent('fb_mobile_search', {
      fb_search_string: query,
    }),

  trackAddToGarage: (make: string, model: string, year: number) =>
    eventsLogger.logEvent('fb_mobile_add_to_wishlist', {
      fb_content_type: 'motorcycle',
      fb_description: `${year} ${make} ${model}`,
    }),

  trackStartTrial: (offerId: string) =>
    eventsLogger.logEvent('fb_mobile_activate_app', {
      fb_content_id: offerId,
    }),

  trackSubscribe: (revenue: number, currency: string, packageId: string) =>
    eventsLogger.logPurchase(revenue, currency, {
      fb_content_id: packageId,
    }),

  trackStartDiagnostic: () =>
    eventsLogger.logEvent('fb_mobile_rate', {
      fb_content_type: 'ai_diagnostic',
    }),

  trackLogRide: () =>
    eventsLogger.logEvent('fb_mobile_achievement_unlocked', {
      fb_description: 'ride_logged',
      fb_content_type: 'ride',
    }),

  /**
   * Meta's copy of a maintenance entry. The canonical PostHog event is
   * `maintenance_task_created`. The old `maintenance_log_added` alias only
   * duplicated that inside PostHog and is gone; this SDK call is Meta's copy.
   */
  trackLogMaintenance: (maintenanceType: string) =>
    eventsLogger.logEvent('fb_mobile_spent_credits', {
      fb_content_type: 'maintenance',
      fb_description: maintenanceType,
    }),
};
