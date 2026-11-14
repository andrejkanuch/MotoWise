// Issue 365 T08 (FS-PO2a): a free rider whose monthly diagnosis is used gets a
// FORBIDDEN from submitDiagnostic. The form then shows an in-form limit panel
// instead of the raw server text and an enabled "Try Again", presents the
// automatic paywall at most once, and its "Done" closes the form for good.
//
// Kept out of src/app (apps/mobile/CLAUDE.md: never put tests under src/app,
// Expo Router would bundle them as routes).

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: {
    DIAGNOSTIC_STARTED: 'diagnostic_started',
    DIAGNOSTIC_SUBMITTED: 'diagnostic_submitted',
    DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
    DIAGNOSTIC_FAILED: 'diagnostic_failed',
    DIAGNOSTIC_LIMIT_REACHED: 'diagnostic_limit_reached',
  },
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
jest.mock('@/lib/meta-analytics', () => ({
  MetaAnalytics: { trackStartDiagnostic: jest.fn() },
}));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));
// `t` echoes the key and its options, so a test can see which copy and which
// date reached the screen without loading the locale files.
let mockLanguage = 'en';
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { language: mockLanguage },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
// Online: the offline pre-check (issue 365 T17) lets the submit through.
jest.mock('expo-network', () => require('@/test/mocks').mockNetwork(true));
// The review step's bike list (query-options pulls in MMKV through the auth store).
jest.mock('@/lib/query-options', () => ({
  motorcyclesOptions: () => ({
    queryKey: ['motorcycles'],
    queryFn: async () => ({ myMotorcycles: [] }),
  }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('@/components/ui/native-toggle', () => ({ NativeToggle: () => null }));
jest.mock('@/components/diagnostic-flow/step-bike-selection', () => ({
  StepBikeSelection: () => null,
}));
jest.mock('@/components/diagnostic-flow/step-problem-description', () => ({
  StepProblemDescription: () => null,
}));
jest.mock('@/components/diagnostic-flow/step-photo-details', () => ({
  StepPhotoDetails: () => null,
}));

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: () => true,
};
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => ({ entry: 'list' }),
    useFocusEffect: (callback: () => void) => {
      useEffect(() => callback(), [callback]);
    },
  };
});

import { DiagnosticQuotaDocument, SubmitDiagnosticDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import NewDiagnosticScreen from '@/app/(tabs)/(diagnose)/new';
import { useDiagnosticFlowStore } from '@/stores/diagnostic-flow.store';
import { useSubscriptionStore } from '@/stores/subscription.store';

const SERVER_MESSAGE = 'Monthly AI diagnostic limit reached. Upgrade to Pro for unlimited.';
const TRY_AGAIN = 'diagnoseV2.tryAgain';
const ANALYZE = 'diagnoseV2.analyze';
const LIMIT_PANEL = 'diagnose-limit-panel';
const RESET = '2026-12-01T00:00:00.000Z';
const DIAGNOSE_LIST = '/(tabs)/(diagnose)';
// The quota query keeps its own `retry: 1` (about a 1 s backoff after the
// offline failure) before the refetch lands, so date lookups wait longer than
// the default 1 s.
const QUOTA_REFETCH = { timeout: 5000 };

const forbidden = () =>
  Object.assign(new Error(SERVER_MESSAGE), {
    response: { errors: [{ message: SERVER_MESSAGE, extensions: { code: 'FORBIDDEN' } }] },
  });

type QuotaReply = { resetDate: string | null } | 'offline';

/** gqlFetcher by document: the quota (or offline), and a FORBIDDEN submit. */
function serveApi(quota: QuotaReply) {
  mockFetcher.mockImplementation(async (document: unknown) => {
    if (document === DiagnosticQuotaDocument) {
      if (quota === 'offline') throw new Error('Network request failed');
      return { diagnosticQuota: { used: 1, limit: 1, resetDate: quota.resetDate } };
    }
    if (document === SubmitDiagnosticDocument) throw forbidden();
    throw new Error('unexpected document');
  });
}

const submitCalls = () =>
  mockFetcher.mock.calls.filter(([document]) => document === SubmitDiagnosticDocument);

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** The repro: the form is reached while the quota is unknown, then filled to the review step. */
async function openFilledReviewStep() {
  await render(<NewDiagnosticScreen />, { wrapper });
  await act(async () => {
    useDiagnosticFlowStore.setState({
      currentStep: 4,
      inputMode: 'freetext',
      freeTextDescription: 'Clicking noise from the front brake',
    });
  });
}

async function pressAnalyze() {
  await act(async () => {
    fireEvent.press(screen.getByText(ANALYZE));
  });
  await waitFor(() => expect(submitCalls()).toHaveLength(1));
  await waitFor(() => expect(useDiagnosticFlowStore.getState().isSubmitting).toBe(false));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = 'en';
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useSubscriptionStore.setState({ isPro: false, isVerified: true });
  useDiagnosticFlowStore.getState().reset();
  mockPresentPaywall.mockResolvedValue('cancelled');
});

describe('diagnose form: free diagnosis used (FORBIDDEN)', () => {
  it('shows the limit panel once, with no "Try Again" and no server text', async () => {
    serveApi('offline');
    await openFilledReviewStep();
    await pressAnalyze();

    expect(await screen.findByTestId(LIMIT_PANEL)).toBeTruthy();
    expect(screen.queryByText(TRY_AGAIN)).toBeNull();
    expect(screen.queryByText(ANALYZE)).toBeNull();
    expect(screen.queryByText(SERVER_MESSAGE, { exact: false })).toBeNull();
    expect(screen.getByTestId('diagnose-limit-see-pro')).toBeTruthy();
    expect(screen.getByTestId('diagnose-limit-done')).toBeTruthy();
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('diagnostic_limit_reached');
  });

  it('a second submit is a no-op: no request, no second automatic paywall', async () => {
    serveApi('offline');
    await openFilledReviewStep();
    await pressAnalyze();

    // Whatever the review step still offers, pressing it must not re-submit.
    const retry = screen.queryByText(TRY_AGAIN) ?? screen.queryByText(ANALYZE);
    if (retry) {
      await act(async () => {
        fireEvent.press(retry);
      });
    }
    await act(async () => {});

    expect(submitCalls()).toHaveLength(1);
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
  });

  it('the quota loading after the limit does not open the entry gate paywall too', async () => {
    serveApi('offline');
    await openFilledReviewStep();
    serveApi({ resetDate: RESET });
    await pressAnalyze();

    expect(await screen.findByText(/December 1st, 2026/, {}, QUOTA_REFETCH)).toBeTruthy();
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('"See Pro plans" opens the paywall as a rider tap', async () => {
    serveApi('offline');
    await openFilledReviewStep();
    await pressAnalyze();

    await act(async () => {
      fireEvent.press(await screen.findByTestId('diagnose-limit-see-pro'));
    });

    expect(mockPresentPaywall).toHaveBeenCalledTimes(2);
    expect(mockPresentPaywall).toHaveBeenLastCalledWith(
      expect.objectContaining({ feature: 'full_ai_diagnostics', trigger: 'rider_tap' }),
    );
  });

  it.each([
    ['en', 'December 1st, 2026'],
    ['de', '1. Dezember 2026'],
  ])('formats a known reset date in the app language (%s)', async (language, expected) => {
    mockLanguage = language;
    // The form was reached offline; the quota answers once the rider is back online.
    serveApi('offline');
    await openFilledReviewStep();
    serveApi({ resetDate: RESET });
    await pressAnalyze();

    const panel = await screen.findByTestId(LIMIT_PANEL);
    expect(panel).toBeTruthy();
    expect(
      await screen.findByText(
        `diagnose.limit.usedBackOn ${JSON.stringify({ date: expected })}`,
        {},
        QUOTA_REFETCH,
      ),
    ).toBeTruthy();
  });

  it('says "It resets next month" when the reset date is unknown', async () => {
    serveApi('offline');
    await openFilledReviewStep();
    await pressAnalyze();

    expect(await screen.findByText('diagnose.limit.usedResetsNextMonth')).toBeTruthy();
    expect(screen.queryByText(/Invalid date/)).toBeNull();
  });

  it('"Done" returns to the Diagnose list and clears the form', async () => {
    serveApi('offline');
    await openFilledReviewStep();
    await pressAnalyze();

    await act(async () => {
      fireEvent.press(await screen.findByTestId('diagnose-limit-done'));
    });

    expect(mockRouter.dismissTo).toHaveBeenCalledWith(DIAGNOSE_LIST);
    const state = useDiagnosticFlowStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.hasAnyData()).toBe(false);
    expect(state.freeTextDescription).toBe('');
    expect(state.submitFailure).toBeNull();
  });
});
