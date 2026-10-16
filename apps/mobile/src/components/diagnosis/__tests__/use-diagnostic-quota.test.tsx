// The gate's promises: tell a free rider BEFORE the form once the monthly
// diagnosis is used, never block a Pro rider (even before RevenueCat hydrates),
// never pop the paywall over a diagnosis that just succeeded.

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockPresentPaywall = jest.fn();
jest.mock('@/lib/subscription', () => ({
  presentPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { useSubscriptionStore } from '@/stores/subscription.store';
import { useDiagnosticEntryGate } from '../use-diagnostic-entry-gate';
import { recordDiagnosisSubmitted, useDiagnosticQuota } from '../use-diagnostic-quota';
import { useStartDiagnosis } from '../use-start-diagnosis';

const RESET = '2026-11-01T00:00:00.000Z';
const quota = (used: number) => ({ diagnosticQuota: { used, limit: 1, resetDate: RESET } });

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Mounts the gate and resolves once the hook has RENDERED with the count. */
async function renderGate(onBlocked: () => void) {
  const { result } = await renderHook(
    () => {
      useDiagnosticEntryGate(onBlocked);
      return useDiagnosticQuota();
    },
    { wrapper },
  );
  await waitFor(() => expect(result.current.resetDate).toBe(RESET));
  await act(async () => {});
  return result;
}

async function setSubscription(state: { isPro: boolean; isVerified: boolean }) {
  await act(async () => useSubscriptionStore.setState(state));
}

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useSubscriptionStore.setState({ isPro: false, isVerified: true });
  mockPresentPaywall.mockResolvedValue('cancelled');
});

describe('useDiagnosticEntryGate', () => {
  it('opens the paywall once for a free rider who used the diagnosis, then leaves', async () => {
    mockFetcher.mockResolvedValue(quota(1));
    const onBlocked = jest.fn();
    const { rerender } = await renderHook(() => useDiagnosticEntryGate(onBlocked), { wrapper });

    await waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1));
    await rerender({});
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
  });

  it('lets a free rider with the diagnosis left straight in', async () => {
    mockFetcher.mockResolvedValue(quota(0));
    const onBlocked = jest.fn();
    await renderGate(onBlocked);
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('waits for RevenueCat: a Pro rider is not blocked while isPro still reads false', async () => {
    await setSubscription({ isPro: false, isVerified: false });
    mockFetcher.mockResolvedValue(quota(3));
    const onBlocked = jest.fn();
    await renderGate(onBlocked);
    expect(mockPresentPaywall).not.toHaveBeenCalled();

    await setSubscription({ isPro: true, isVerified: true });
    await act(async () => {});
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('does not re-check when the count rises after a successful submit', async () => {
    mockFetcher.mockResolvedValue(quota(0));
    const onBlocked = jest.fn();
    const quotaState = await renderGate(onBlocked);

    await act(async () => recordDiagnosisSubmitted(queryClient));
    await waitFor(() => expect(quotaState.current.isExhausted).toBe(true));
    await act(async () => {});
    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('keeps the form open when the rider buys Pro from the paywall', async () => {
    mockFetcher.mockResolvedValue(quota(1));
    mockPresentPaywall.mockImplementation(async () => {
      useSubscriptionStore.setState({ isPro: true });
      return 'purchased';
    });
    const onBlocked = jest.fn();
    await renderHook(() => useDiagnosticEntryGate(onBlocked), { wrapper });

    await waitFor(() => expect(mockPresentPaywall).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(onBlocked).not.toHaveBeenCalled();
  });
});

describe('useDiagnosticEntryGate after the form is gone', () => {
  it('neither presents nor navigates once the rider closed the form while offerings loaded', async () => {
    mockFetcher.mockResolvedValue(quota(1));
    let resolvePaywall: (result: string) => void = () => {};
    let abortCheck: (() => boolean) | undefined;
    mockPresentPaywall.mockImplementation((options: { shouldAbort?: () => boolean }) => {
      abortCheck = options.shouldAbort;
      return new Promise((resolve) => {
        resolvePaywall = resolve;
      });
    });
    const onBlocked = jest.fn();
    const { unmount } = await renderHook(() => useDiagnosticEntryGate(onBlocked), { wrapper });
    await waitFor(() => expect(mockPresentPaywall).toHaveBeenCalledTimes(1));

    await unmount();
    expect(abortCheck?.()).toBe(true);
    await act(async () => resolvePaywall('not_presented'));
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('still closes the form when the paywall fails to show, so the rider is not left in a blocked form', async () => {
    mockFetcher.mockResolvedValue(quota(1));
    mockPresentPaywall.mockResolvedValue('error');
    const onBlocked = jest.fn();
    await renderHook(() => useDiagnosticEntryGate(onBlocked), { wrapper });

    await waitFor(() => expect(onBlocked).toHaveBeenCalledTimes(1));
  });
});

describe('useStartDiagnosis', () => {
  it('opens the flow while the quota is still unknown (server limit is the backstop)', async () => {
    mockFetcher.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useStartDiagnosis(), { wrapper });

    await act(async () => result.current());
    expect(mockPush).toHaveBeenCalledWith('/(diagnose)/new');
  });

  it('opens the paywall instead of the flow once the diagnosis is used', async () => {
    mockFetcher.mockResolvedValue(quota(1));
    const { result } = await renderHook(
      () => ({ start: useStartDiagnosis(), quota: useDiagnosticQuota() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.quota.isKnown).toBe(true));

    await act(async () => result.current.start());
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
  });
});

describe('recordDiagnosisSubmitted', () => {
  it('counts the diagnosis locally instead of refetching a count the server may not have logged yet', () => {
    queryClient.setQueryData(queryKeys.diagnostics.quota, quota(0));
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    recordDiagnosisSubmitted(queryClient);

    expect(queryClient.getQueryData(queryKeys.diagnostics.quota)).toEqual(quota(1));
    const { predicate } = invalidate.mock.calls[0]?.[0] ?? {};
    const isInvalidated = (queryKey: readonly unknown[]) =>
      predicate?.({ queryKey } as never) ?? true;
    expect(isInvalidated(queryKeys.diagnostics.quota)).toBe(false);
    expect(isInvalidated(queryKeys.diagnostics.all)).toBe(true);
  });
});
