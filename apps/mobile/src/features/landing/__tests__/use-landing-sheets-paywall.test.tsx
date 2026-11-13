// Home's landing-sheet owners (issue 365 T16b): a paywall that opens during the
// sheet's show delay holds the sheet, which shows once the paywall closes.
// Its own file: the app's queue allows one sheet per process.
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
const mockFlight: { settle: (() => void) | null } = { settle: null };
jest.mock('@/lib/subscription', () => ({
  isPaywallInFlight: () => mockEnv.paywallInFlight,
  paywallFlightSettled: () =>
    mockEnv.paywallInFlight
      ? new Promise<void>((resolve) => {
          mockFlight.settle = resolve;
        })
      : null,
}));

import { landingSheetQueue } from '@/lib/landing-sheet-queue';
import { queryKeys } from '@/lib/query-keys';
import { useLandingSheetsStore } from '@/stores/landing-sheets.store';
import { LANDING_SHEET_DELAY_MS, useLandingSheets } from '../use-landing-sheets';

const BIKE = {
  id: 'bike-1',
  make: 'Yamaha',
  model: 'MT-09',
  year: 2019,
  isPrimary: true,
  recallCount: 1,
};

beforeEach(() => {
  jest.useFakeTimers();
  useLandingSheetsStore.setState({ landingSessionId: null, owed: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLandingSheets with a paywall opening during the delay', () => {
  it('shows the sheet once the paywall closes', async () => {
    landingSheetQueue.noteLanding();
    jest.advanceTimersByTime(1);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.motorcycles.all, { myMotorcycles: [BIKE] });
    client.setQueryData(queryKeys.maintenanceTasks.allUser, {
      allMaintenanceTasks: [{ id: 't1', motorcycleId: 'bike-1', completedAt: null }],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    await renderHook(() => useLandingSheets(), { wrapper });

    mockEnv.paywallInFlight = true;
    await act(async () => {
      jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS);
    });
    expect(mockPush).not.toHaveBeenCalled();

    mockEnv.paywallInFlight = false;
    await act(async () => {
      mockFlight.settle?.();
    });
    await act(async () => {
      jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS);
    });
    expect(mockPush.mock.calls.map(([href]) => href.pathname)).toEqual(['/(modals)/recalls']);
  });
});
