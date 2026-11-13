// #365 T05b (FS-PO2d): `diagnostic_started` fires once per entry into the
// diagnose form, never on a refocus of the form, and always says which entry
// opened it. Wire values are pinned as literals: they are what PostHog queries.

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
const mockTrackStartDiagnostic = jest.fn();
jest.mock('@/lib/meta-analytics', () => ({
  MetaAnalytics: { trackStartDiagnostic: () => mockTrackStartDiagnostic() },
}));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/components/diagnostic-flow/step-bike-selection', () => ({
  StepBikeSelection: () => null,
}));
jest.mock('@/components/diagnostic-flow/step-problem-description', () => ({
  StepProblemDescription: () => null,
}));
jest.mock('@/components/diagnostic-flow/step-photo-details', () => ({
  StepPhotoDetails: () => null,
}));
jest.mock('@/components/diagnostic-flow/step-review-submit', () => ({
  StepReviewSubmit: () => null,
}));

// expo-router: `useFocusEffect` runs on mount, and `refocus()` replays every
// registered focus callback the way coming back to the screen does.
const mockPush = jest.fn();
let mockParams: Record<string, string | undefined> = {};
const mockFocusCallbacks = new Set<() => void>();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({
      push: mockPush,
      back: jest.fn(),
      replace: jest.fn(),
      canGoBack: () => true,
    }),
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (callback: () => void) => {
      useEffect(() => {
        mockFocusCallbacks.add(callback);
        callback();
        return () => {
          mockFocusCallbacks.delete(callback);
        };
      }, [callback]);
    },
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import NewDiagnosticScreen from '@/app/(tabs)/(diagnose)/new';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useDiagnosticEntryGate } from '../use-diagnostic-entry-gate';
import { useDiagnosticQuota } from '../use-diagnostic-quota';
import { useStartDiagnosis } from '../use-start-diagnosis';

const DIAGNOSTIC_STARTED = 'diagnostic_started';
const RESET = '2026-11-01T00:00:00.000Z';
const quota = (used: number) => ({ diagnosticQuota: { used, limit: 1, resetDate: RESET } });

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const startedCalls = () =>
  mockTrackEvent.mock.calls.filter(([event]) => event === DIAGNOSTIC_STARTED);

function refocus() {
  for (const callback of [...mockFocusCallbacks]) callback();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockFocusCallbacks.clear();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useSubscriptionStore.setState({ isPro: false, isVerified: true });
  mockPresentPaywall.mockResolvedValue('cancelled');
});

describe('useStartDiagnosis', () => {
  it.each([
    'list',
    'detail',
    'home_tool',
  ] as const)('fires diagnostic_started once with entry "%s" and opens the form', async (entry) => {
    mockFetcher.mockResolvedValue(quota(0));
    const { result, rerender } = await renderHook(() => useStartDiagnosis(entry), { wrapper });

    await act(async () => result.current());
    await rerender({});

    expect(startedCalls()).toEqual([[DIAGNOSTIC_STARTED, { entry }]]);
    expect(mockTrackStartDiagnostic).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/(diagnose)/new', params: { entry } }),
    );
  });

  it('does not fire when the used diagnosis sends the rider to the paywall instead', async () => {
    mockFetcher.mockResolvedValue(quota(1));
    const { result } = await renderHook(
      () => ({ start: useStartDiagnosis('list'), quota: useDiagnosticQuota() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.quota.isKnown).toBe(true));

    await act(async () => result.current.start());

    expect(mockPush).not.toHaveBeenCalled();
    expect(startedCalls()).toEqual([]);
  });
});

describe('useDiagnosticEntryGate', () => {
  it('fires diagnostic_started once with entry "quick_action" when the form opened without an in-app start', async () => {
    mockFetcher.mockResolvedValue(quota(0));
    const { rerender } = await renderHook(() => useDiagnosticEntryGate(jest.fn()), { wrapper });
    await waitFor(() => expect(mockFetcher).toHaveBeenCalled());
    await rerender({});
    await rerender({});

    expect(startedCalls()).toEqual([[DIAGNOSTIC_STARTED, { entry: 'quick_action' }]]);
  });

  it('does not fire again for a form an in-app start already counted', async () => {
    mockFetcher.mockResolvedValue(quota(0));
    mockParams = { entry: 'list' };
    await renderHook(() => useDiagnosticEntryGate(jest.fn()), { wrapper });
    await waitFor(() => expect(mockFetcher).toHaveBeenCalled());
    await act(async () => {});

    expect(startedCalls()).toEqual([]);
  });
});

describe('the diagnose form', () => {
  it('fires nothing itself, however often it is refocused, when an in-app start opened it', async () => {
    mockFetcher.mockResolvedValue(quota(0));
    mockParams = { entry: 'list' };
    await render(<NewDiagnosticScreen />, { wrapper });
    await waitFor(() => expect(mockFetcher).toHaveBeenCalled());

    await act(async () => refocus());
    await act(async () => refocus());

    expect(startedCalls()).toEqual([]);
  });

  it('fires exactly once for the quick action, however often it is refocused', async () => {
    mockFetcher.mockResolvedValue(quota(0));
    await render(<NewDiagnosticScreen />, { wrapper });
    await waitFor(() => expect(mockFetcher).toHaveBeenCalled());

    await act(async () => refocus());
    await act(async () => refocus());

    expect(startedCalls()).toEqual([[DIAGNOSTIC_STARTED, { entry: 'quick_action' }]]);
  });
});
