// Home's landing-sheet owners (issue 365 T16b, FS-PO17): a refresh of data cached
// before landing that fails must not be retried forever; the sheets wait for a
// later session. Its own file: the app's queue allows one sheet per process.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/lib/onboarding-experiment', () => ({ getOnboardingVariant: () => 'shipped' }));
jest.mock('@/lib/graphql-client', () => ({ gqlFetcher: jest.fn(() => new Promise(() => {})) }));

const mockPush = jest.fn();
const mockEnv = { focused: true, consentOwed: false, paywallInFlight: false };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useIsFocused: () => mockEnv.focused,
}));
jest.mock('@/lib/analytics-consent', () => ({ isConsentPromptOwed: () => mockEnv.consentOwed }));
jest.mock('@/lib/subscription', () => ({
  isPaywallInFlight: () => mockEnv.paywallInFlight,
  paywallFlightSettled: () => null,
}));

import { LANDING_SHEET, landingSheetQueue } from '@/lib/landing-sheet-queue';
import { queryKeys } from '@/lib/query-keys';
import { useLandingSheetsStore } from '@/stores/landing-sheets.store';
import { LANDING_SHEET_DELAY_MS, useLandingSheets } from '../use-landing-sheets';

beforeEach(() => {
  jest.useFakeTimers();
  useLandingSheetsStore.setState({ landingSessionId: null, owed: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLandingSheets when the refresh after landing fails', () => {
  it('stops refetching, shows nothing and keeps both sheets owed', async () => {
    const { gqlFetcher } = jest.requireMock('@/lib/graphql-client') as { gqlFetcher: jest.Mock };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.motorcycles.all, { myMotorcycles: [] });
    client.setQueryData(queryKeys.maintenanceTasks.allUser, { allMaintenanceTasks: [] });
    jest.advanceTimersByTime(1);
    landingSheetQueue.noteLanding();
    gqlFetcher.mockReset();
    gqlFetcher.mockImplementation(() => Promise.reject(new Error('offline')));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    await renderHook(() => useLandingSheets(), { wrapper });
    for (let step = 0; step < 5; step += 1) {
      await act(async () => {
        jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS);
      });
    }

    // One refresh per query, not one per settle.
    expect(gqlFetcher.mock.calls.length).toBeLessThanOrEqual(2);
    expect(mockPush).not.toHaveBeenCalled();
    expect(useLandingSheetsStore.getState().owed).toEqual([
      LANDING_SHEET.RECALL,
      LANDING_SHEET.SERVICE_PLAN_READY,
    ]);
    expect(landingSheetQueue.canRequest(LANDING_SHEET.WHATS_NEW)).toBe(false);
    gqlFetcher.mockImplementation(() => new Promise(() => {}));
  });
});
