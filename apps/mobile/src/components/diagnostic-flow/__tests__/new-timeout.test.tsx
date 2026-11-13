// Issue 365 T17 (FS-PO2b): diagnosis failures. A diagnosis that fails used to
// hang under a 300 s client timeout and then show the raw server text. Now:
// an offline pre-check sends nothing, "Still working…" shows after 10 s, the
// client gives up at 75 s with copy that never claims the free diagnosis was
// kept, and submit stays locked until the server's own retry window (≈ 240 s)
// has passed and the quota says the diagnosis was not used.
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
let mockOnline = true;
jest.mock('expo-network', () => ({
  getNetworkStateAsync: () =>
    Promise.resolve({ isConnected: mockOnline, isInternetReachable: mockOnline }),
  addNetworkStateListener: () => ({ remove: () => {} }),
}));
// The real English copy, so the assertions read what a rider reads (and can
// prove a sentence is absent, not just a key).
jest.mock('react-i18next', () => {
  const en = require('@/i18n/locales/en.json');
  const lookup = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
  return {
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const value = lookup(key);
        if (typeof value !== 'string') return key;
        return value.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ''));
      },
      i18n: { language: 'en' },
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn() }));
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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import NewDiagnosticScreen from '@/app/(tabs)/(diagnose)/new';
import { GqlRequestTimeoutError } from '@/lib/graphql-error-classification';
import { useDiagnosticFlowStore } from '@/stores/diagnostic-flow.store';
import { useSubscriptionStore } from '@/stores/subscription.store';

const ANALYZE = 'Analyze';
const STILL_WORKING = 'Still working…';
const DEADLINE_COPY = 'Still working — if it finishes, it will appear in your diagnoses.';
const OFFLINE_COPY = /You're offline\. Your answers are kept/;
const NOT_USED_COPY = /wasn't used|was not used|not used/i;
const RETRY = 'Retry';
const PROBLEM = 'Clicking noise from the front brake';
const SERVER_TEXT = 'OpenAI upstream error: 500 Internal Server Error';
/** The 75 s client deadline and the API's own window, AI_CLIENT 60 s × (1 + 3 retries). */
const DEADLINE_MS = 75_000;
const SERVER_WINDOW_MS = 240_000;

type QuotaReply = { used: number } | 'error';
type SubmitReply = 'hang' | 'deadline' | Error;

let quotaReply: QuotaReply = { used: 0 };
let submitReply: SubmitReply = 'hang';

function serveApi() {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === DiagnosticQuotaDocument) {
      if (quotaReply === 'error') return Promise.reject(new Error('Network request failed'));
      return Promise.resolve({
        diagnosticQuota: { used: quotaReply.used, limit: 1, resetDate: null },
      });
    }
    if (document === SubmitDiagnosticDocument) {
      if (submitReply === 'hang') return new Promise(() => {});
      if (submitReply === 'deadline') {
        // What gqlFetcher does once GQL_TIMEOUT_MS.DIAGNOSIS runs out.
        return new Promise((_, reject) => {
          setTimeout(
            () => reject(new GqlRequestTimeoutError(DEADLINE_MS, 'SubmitDiagnostic')),
            DEADLINE_MS,
          );
        });
      }
      return Promise.reject(submitReply);
    }
    return Promise.reject(new Error('unexpected document'));
  });
}

const callsOf = (document: unknown) =>
  mockFetcher.mock.calls.filter(([called]) => called === document).length;
const submitCalls = () => callsOf(SubmitDiagnosticDocument);
const quotaCalls = () => callsOf(DiagnosticQuotaDocument);

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function openFilledReviewStep() {
  await render(<NewDiagnosticScreen />, { wrapper });
  await act(async () => {
    useDiagnosticFlowStore.setState({
      currentStep: 4,
      inputMode: 'freetext',
      freeTextDescription: PROBLEM,
    });
  });
  await advance(0);
}

const analyzeButton = () => screen.getByRole('button', { name: new RegExp(ANALYZE) });

async function pressAnalyze() {
  await act(async () => {
    fireEvent.press(analyzeButton());
  });
  await advance(0);
}

function expectAnalyzeDisabled(disabled: boolean) {
  expect(analyzeButton().props.accessibilityState?.disabled).toBe(disabled);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockOnline = true;
  quotaReply = { used: 0 };
  submitReply = 'hang';
  serveApi();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useSubscriptionStore.setState({ isPro: false, isVerified: true });
  useDiagnosticFlowStore.setState({ deadlineLock: null });
  useDiagnosticFlowStore.getState().reset();
  mockPresentPaywall.mockResolvedValue('cancelled');
});

afterEach(() => {
  jest.useRealTimers();
});

describe('diagnose submit: in flight', () => {
  it('shows a spinner from the send and "Still working…" only from 10 s', async () => {
    await openFilledReviewStep();
    await pressAnalyze();

    expect(submitCalls()).toBe(1);
    // The spinner: the submit button is busy (and disabled) from the send.
    expect(screen.getByRole('button', { busy: true, disabled: true })).toBeTruthy();
    expect(screen.queryByText(STILL_WORKING)).toBeNull();

    await advance(9_900);
    expect(screen.queryByText(STILL_WORKING)).toBeNull();

    await advance(100);
    expect(screen.getByText(STILL_WORKING)).toBeTruthy();
  });
});

describe('diagnose submit: the 75 s client deadline', () => {
  beforeEach(() => {
    submitReply = 'deadline';
  });

  async function reachDeadline() {
    await openFilledReviewStep();
    await pressAnalyze();
    await advance(DEADLINE_MS);
  }

  it('says it is still working, never that the free diagnosis was not used', async () => {
    await reachDeadline();

    expect(screen.getByText(DEADLINE_COPY)).toBeTruthy();
    expect(screen.queryByText(NOT_USED_COPY)).toBeNull();
    expect(screen.queryByText(/timed out/i)).toBeNull();
    expectAnalyzeDisabled(true);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'diagnostic_failed',
      expect.objectContaining({ reason: 'timeout' }),
    );
  });

  it('keeps submit locked until the server window ends (239 s), then checks the quota', async () => {
    await reachDeadline();
    const quotaCallsAtDeadline = quotaCalls();

    await advance(SERVER_WINDOW_MS - DEADLINE_MS - 1_000);
    expectAnalyzeDisabled(true);
    await act(async () => {
      fireEvent.press(analyzeButton());
    });
    expect(submitCalls()).toBe(1);
    expect(quotaCalls()).toBe(quotaCallsAtDeadline);

    await advance(1_000);
    expect(quotaCalls()).toBe(quotaCallsAtDeadline + 1);
    expectAnalyzeDisabled(false);
    expect(screen.queryByText(DEADLINE_COPY)).toBeNull();
  });

  it('shows the limit panel when the quota says the diagnosis was used', async () => {
    await reachDeadline();
    quotaReply = { used: 1 };

    await advance(SERVER_WINDOW_MS - DEADLINE_MS);

    expect(screen.getByTestId('diagnose-limit-panel')).toBeTruthy();
    expect(screen.queryByText(ANALYZE)).toBeNull();
    expect(submitCalls()).toBe(1);
  });

  it('a failed quota check shows Retry, which checks again before any submit', async () => {
    await reachDeadline();
    quotaReply = 'error';
    await advance(SERVER_WINDOW_MS - DEADLINE_MS);

    const quotaCallsAfterFailure = quotaCalls();
    expect(screen.getByText(RETRY)).toBeTruthy();
    expectAnalyzeDisabled(true);

    quotaReply = { used: 0 };
    await act(async () => {
      fireEvent.press(screen.getByText(RETRY));
    });
    await advance(0);

    expect(quotaCalls()).toBe(quotaCallsAfterFailure + 1);
    expect(submitCalls()).toBe(1);
    expect(screen.queryByText(RETRY)).toBeNull();
    expectAnalyzeDisabled(false);
  });

  it('Back keeps the answers while submit is locked', async () => {
    await reachDeadline();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Back'));
    });
    await advance(300);

    const state = useDiagnosticFlowStore.getState();
    expect(state.currentStep).toBe(3);
    expect(state.freeTextDescription).toBe(PROBLEM);
  });
});

describe('diagnose submit: offline and error copy', () => {
  it('offline before sending: no request, the offline copy and a typed failure event', async () => {
    mockOnline = false;
    await openFilledReviewStep();
    await pressAnalyze();

    expect(submitCalls()).toBe(0);
    expect(screen.getByText(OFFLINE_COPY)).toBeTruthy();
    expect(screen.queryByText(/Network request failed|Failed to analyze/)).toBeNull();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'diagnostic_failed',
      expect.objectContaining({ reason: 'offline', precheck: true }),
    );
    expect(mockTrackEvent).not.toHaveBeenCalledWith('diagnostic_submitted', expect.anything());
    expect(useDiagnosticFlowStore.getState().freeTextDescription).toBe(PROBLEM);
  });

  it.each([
    ['a dropped connection', new TypeError('Network request failed'), OFFLINE_COPY],
    [
      'the rate limit',
      Object.assign(new Error('Too many requests'), {
        response: {
          errors: [{ message: 'Too many requests', extensions: { code: 'TOO_MANY_REQUESTS' } }],
        },
      }),
      /Too many requests right now/,
    ],
    [
      'a server error',
      Object.assign(new Error(SERVER_TEXT), {
        response: {
          errors: [{ message: SERVER_TEXT, extensions: { code: 'INTERNAL_SERVER_ERROR' } }],
        },
      }),
      /Something went wrong on our side/,
    ],
  ])('maps %s to localized copy, never the raw text', async (_name, error, copy) => {
    submitReply = error;
    await openFilledReviewStep();
    await pressAnalyze();

    expect(screen.getByText(copy)).toBeTruthy();
    expect(screen.queryByText(SERVER_TEXT, { exact: false })).toBeNull();
    expect(screen.queryByText(/Network request failed/)).toBeNull();
    expect(screen.getByText('Try Again')).toBeTruthy();
  });
});
