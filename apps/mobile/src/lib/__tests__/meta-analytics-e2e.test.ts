jest.mock('react-native-fbsdk-next', () => require('react-native-fbsdk-next/jest/mocks').default);

const { AppEventsLogger } = jest.requireMock('react-native-fbsdk-next');

describe('MetaAnalytics in an E2E build with vendor SDKs off', () => {
  const saved = process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS;

  afterEach(() => {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS;
    else process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS = saved;
    jest.clearAllMocks();
  });

  it('sends no events or purchases to Meta', () => {
    process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS = '1';
    jest.isolateModules(() => {
      const { MetaAnalytics } = require('../meta-analytics');
      MetaAnalytics.trackCompleteRegistration('evt_1');
      MetaAnalytics.trackLogRide();
      MetaAnalytics.trackSubscribe(9.99, 'EUR', 'pkg');
    });
    expect(AppEventsLogger.logEvent).not.toHaveBeenCalled();
    expect(AppEventsLogger.logPurchase).not.toHaveBeenCalled();
  });

  it('still sends events when the switch is off (store builds)', () => {
    delete process.env.EXPO_PUBLIC_E2E_NO_VENDOR_SDKS;
    jest.isolateModules(() => {
      const { MetaAnalytics } = require('../meta-analytics');
      MetaAnalytics.trackLogRide();
    });
    expect(AppEventsLogger.logEvent).toHaveBeenCalledTimes(1);
  });
});
