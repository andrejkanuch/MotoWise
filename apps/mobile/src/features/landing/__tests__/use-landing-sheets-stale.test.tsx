// Home's landing-sheet owners (issue 365 T16b, FS-PO17): the garage cached before
// the rider landed (empty, from before onboarding added the bike) must not drop
// the landing sheets. Its own file: the app's queue allows one sheet per process.
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

const BIKE = {
  id: 'bike-1',
  make: 'Yamaha',
  model: 'MT-09',
  year: 2019,
  isPrimary: true,
  recallCount: 1,
};

const pushedPaths = () => mockPush.mock.calls.map(([href]) => href.pathname);

beforeEach(() => {
  jest.useFakeTimers();
  useLandingSheetsStore.setState({ landingSessionId: null, owed: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLandingSheets with a garage cached before landing', () => {
  it('an empty garage cached before landing is refetched, not taken as "no bike"', async () => {
    const { gqlFetcher } = jest.requireMock('@/lib/graphql-client') as { gqlFetcher: jest.Mock };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(queryKeys.motorcycles.all, { myMotorcycles: [] });
    client.setQueryData(queryKeys.maintenanceTasks.allUser, { allMaintenanceTasks: [] });
    jest.advanceTimersByTime(1);
    landingSheetQueue.noteLanding();
    gqlFetcher.mockImplementation((document: { definitions?: { name?: { value?: string } }[] }) => {
      const name = document?.definitions?.[0]?.name?.value ?? '';
      return Promise.resolve(
        name.includes('Motorcycle')
          ? { myMotorcycles: [BIKE] }
          : { allMaintenanceTasks: [{ id: 't1', motorcycleId: 'bike-1', completedAt: null }] },
      );
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    await renderHook(() => useLandingSheets(), { wrapper });
    // The refetch resolves, then the sheet's delay runs.
    for (let step = 0; step < 3; step += 1) {
      await act(async () => {
        jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS);
      });
    }

    expect(pushedPaths()).toEqual(['/(modals)/recalls']);
    expect(useLandingSheetsStore.getState().owed).toEqual([LANDING_SHEET.SERVICE_PLAN_READY]);
    gqlFetcher.mockImplementation(() => new Promise(() => {}));
  });
});
