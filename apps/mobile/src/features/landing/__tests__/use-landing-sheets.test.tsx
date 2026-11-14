// Home's landing-sheet owners (issue 365 T16b, FS-PO17): a rider who lands from
// onboarding with a bike that has an open recall AND an imported service plan
// sees ONE sheet, the recall, and "Service plan ready" waits for the next session.
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

import { trackEvent } from '@/lib/analytics';
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

function render(bike = BIKE, tasks = [{ id: 't1', motorcycleId: 'bike-1', completedAt: null }]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.motorcycles.all, { myMotorcycles: [bike] });
  client.setQueryData(queryKeys.maintenanceTasks.allUser, { allMaintenanceTasks: tasks });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useLandingSheets(), { wrapper });
}

const pushedPaths = () => mockPush.mock.calls.map(([href]) => href.pathname);

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
  (trackEvent as jest.Mock).mockClear();
  Object.assign(mockEnv, { focused: true, consentOwed: false, paywallInFlight: false });
  useLandingSheetsStore.setState({ landingSessionId: null, owed: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLandingSheets', () => {
  it('recall and Service plan ready both owed on landing: only the recall sheet opens', async () => {
    landingSheetQueue.noteLanding();
    await render();
    await act(async () => {
      jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS * 3);
    });

    expect(pushedPaths()).toEqual(['/(modals)/recalls']);
    expect(mockPush.mock.calls[0][0].params).toEqual({
      motorcycleId: 'bike-1',
      bikeName: '2019 Yamaha MT-09',
    });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith(
      'LANDING_SHEET_SHOWN',
      expect.objectContaining({ sheet: LANDING_SHEET.RECALL, queue_position: 0 }),
    );
    // Deferred, not lost: owed for the next cold session.
    expect(useLandingSheetsStore.getState().owed).toEqual([LANDING_SHEET.SERVICE_PLAN_READY]);
  });

  it('waits while Home is covered or consent is owed', async () => {
    useLandingSheetsStore.setState({
      landingSessionId: 'earlier',
      owed: [LANDING_SHEET.RECALL, LANDING_SHEET.SERVICE_PLAN_READY],
    });
    mockEnv.focused = false;
    await render();
    await act(async () => {
      jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS * 3);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('owes nothing to a rider who did not land from onboarding here', async () => {
    await render();
    await act(async () => {
      jest.advanceTimersByTime(LANDING_SHEET_DELAY_MS * 3);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
