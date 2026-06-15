/**
 * Shared jest mock factories for the riskiest stateful surfaces (MOT-265).
 *
 * jest.mock factories are hoisted above imports, so reference these via `require`
 * INSIDE the factory, e.g.:
 *
 *   jest.mock('react-native-mmkv', () => require('../test/mocks').makeMmkvMock());
 *   jest.mock('expo-network', () => require('../test/mocks').mockNetwork(true));
 *   jest.mock('../lib/analytics', () => require('../test/mocks').mockAnalytics());
 */
import { jest } from '@jest/globals';

/** An in-memory MMKV stand-in. Returns a module shape matching `react-native-mmkv`. */
export function makeMmkvMock() {
  const store = new Map<string, string | number | boolean>();
  return {
    __store: store,
    createMMKV: () => ({
      getString: (k: string) => {
        const v = store.get(k);
        return typeof v === 'string' ? v : undefined;
      },
      getNumber: (k: string) => {
        const v = store.get(k);
        return typeof v === 'number' ? v : undefined;
      },
      getBoolean: (k: string) => {
        const v = store.get(k);
        return typeof v === 'boolean' ? v : undefined;
      },
      set: (k: string, v: string | number | boolean) => store.set(k, v),
      delete: (k: string) => store.delete(k),
      remove: (k: string) => store.delete(k),
    }),
  };
}

/** A `expo-network` stand-in fixed to the given connectivity. */
export function mockNetwork(online: boolean) {
  return {
    getNetworkStateAsync: () =>
      Promise.resolve({ isConnected: online, isInternetReachable: online }),
    addNetworkStateListener: () => ({ remove: () => {} }),
  };
}

/** A `lib/analytics` stand-in exposing a spyable captureException. */
export function mockAnalytics() {
  return {
    captureException: jest.fn(),
    trackEvent: jest.fn(),
    identifyUser: jest.fn(),
    AnalyticsEvent: new Proxy({}, { get: (_t, p) => String(p) }),
  };
}
