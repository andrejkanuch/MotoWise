import { MetaAnalytics } from '../meta-analytics';

// Use the built-in jest mock from react-native-fbsdk-next
jest.mock('react-native-fbsdk-next', () => require('react-native-fbsdk-next/jest/mocks').default);

const { AppEventsLogger } = jest.requireMock('react-native-fbsdk-next');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('MetaAnalytics', () => {
  describe('trackCompleteRegistration', () => {
    it('fires fb_mobile_complete_registration event', () => {
      MetaAnalytics.trackCompleteRegistration();
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_complete_registration');
    });

    it('includes event_id when provided', () => {
      MetaAnalytics.trackCompleteRegistration('evt_123');
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_complete_registration', {
        event_id: 'evt_123',
      });
    });
  });

  describe('trackViewContent', () => {
    it('fires fb_mobile_content_view with content type and id', () => {
      MetaAnalytics.trackViewContent('article', 'how-to-change-oil');
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_content_view', {
        fb_content_type: 'article',
        fb_content_id: 'how-to-change-oil',
      });
    });
  });

  describe('trackSearch', () => {
    it('fires fb_mobile_search with query string', () => {
      MetaAnalytics.trackSearch('honda cbr');
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_search', {
        fb_search_string: 'honda cbr',
      });
    });
  });

  describe('trackAddToGarage', () => {
    it('fires fb_mobile_add_to_wishlist with motorcycle details', () => {
      MetaAnalytics.trackAddToGarage('Honda', 'CBR600RR', 2024);
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_add_to_wishlist', {
        fb_content_type: 'motorcycle',
        fb_description: '2024 Honda CBR600RR',
      });
    });
  });

  describe('trackStartTrial', () => {
    it('fires fb_mobile_activate_app with offer id', () => {
      MetaAnalytics.trackStartTrial('annual_trial');
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_activate_app', {
        fb_content_id: 'annual_trial',
      });
    });
  });

  describe('trackSubscribe', () => {
    it('fires logPurchase with revenue, currency, and package id', () => {
      MetaAnalytics.trackSubscribe(9.99, 'USD', 'monthly_pro');
      expect(AppEventsLogger.logPurchase).toHaveBeenCalledWith(9.99, 'USD', {
        fb_content_id: 'monthly_pro',
      });
    });
  });

  describe('trackStartDiagnostic', () => {
    it('fires fb_mobile_rate with ai_diagnostic content type', () => {
      MetaAnalytics.trackStartDiagnostic();
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_rate', {
        fb_content_type: 'ai_diagnostic',
      });
    });
  });

  describe('trackLogRide', () => {
    it('fires fb_mobile_achievement_unlocked for ride', () => {
      MetaAnalytics.trackLogRide();
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_achievement_unlocked', {
        fb_description: 'ride_logged',
        fb_content_type: 'ride',
      });
    });
  });

  describe('trackLogMaintenance', () => {
    it('fires fb_mobile_spent_credits with maintenance type', () => {
      MetaAnalytics.trackLogMaintenance('Oil Change');
      expect(AppEventsLogger.logEvent).toHaveBeenCalledWith('fb_mobile_spent_credits', {
        fb_content_type: 'maintenance',
        fb_description: 'Oil Change',
      });
    });
  });
});
