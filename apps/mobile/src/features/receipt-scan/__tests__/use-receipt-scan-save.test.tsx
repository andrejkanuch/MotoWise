// The save hook's `saving` flag locks the review card (Save, Review later and
// Done). These tests pin that it is always released — after a save, a cancelled
// duplicate warning, a failed save — and that a duplicate lookup that never
// answers (offline) cannot hold the lock past its deadline.

const mockGqlFetcher = jest.fn();
const mockFetchQuery = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockGqlFetcher(...args),
}));
jest.mock('@/lib/query-client', () => ({
  queryClient: {
    fetchQuery: (...args: unknown[]) => mockFetchQuery(...args),
    invalidateQueries: jest.fn(),
  },
}));
jest.mock('@/lib/query-options', () => ({
  EXPENSES_ALL_YEARS: 0,
  expensesOptions: () => ({ queryKey: ['expenses'] }),
}));
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: {},
  captureException: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('@/lib/core-action-milestones', () => ({
  CORE_ACTION_KIND: {},
  recordCoreAction: jest.fn(),
}));
jest.mock('@/lib/expense-analytics', () => ({
  EXPENSE_ENTRY_SOURCE: {},
  trackExpenseAdded: jest.fn(),
}));
jest.mock('@/lib/store-review', () => ({
  REVIEW_ACTION: {},
  recordReviewAction: jest.fn(),
}));
jest.mock('@/lib/invalidate', () => ({ invalidateMaintenanceTasks: jest.fn() }));
jest.mock('@/utils/haptics', () => ({ triggerNotification: jest.fn() }));
jest.mock('../durable-receipt-photo', () => ({ deleteDurablePhoto: jest.fn() }));
jest.mock('../parked-scan-store', () => ({ unparkScan: jest.fn() }));
jest.mock('../receipt-scan-undo-store', () => ({
  clearReceiptSaveUndo: jest.fn(),
  pushReceiptSaveUndo: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, type AlertButton } from 'react-native';
import {
  RECEIPT_REVIEW_TYPE,
  type ReceiptReviewHandoff,
  type ReceiptReviewPayload,
} from '../scan-flow-constants';
import { DUPLICATE_CHECK_TIMEOUT_MS, useReceiptScanSave } from '../use-receipt-scan-save';

const HANDOFF = { scanId: 'scan-1' } as ReceiptReviewHandoff;
const PAYLOAD: ReceiptReviewPayload = {
  motorcycleId: 'bike-1',
  type: RECEIPT_REVIEW_TYPE.EXPENSE,
  amount: 42,
  currency: 'EUR',
  date: '2026-11-01',
  vendor: 'Shop',
  itemName: null,
  category: 'parts',
  partsCost: null,
  laborCost: null,
  taxAmount: null,
  taxRate: null,
  lineItems: [],
  reminderServiceTypes: [],
  applyOdometer: false,
  odometerValue: null,
  odometerUnit: null,
};
const SAVED = {
  saveReceiptScan: {
    __typename: 'SaveReceiptScanSuccess',
    refs: { recordType: RECEIPT_REVIEW_TYPE.EXPENSE, odometer: null },
  },
};
/** An expense list holding one entry that matches PAYLOAD (a likely duplicate). */
const DUPLICATE_LIST = {
  expenses: {
    categories: [{ expenses: [{ amount: 42, date: '2026-11-01', description: 'Shop' }] }],
  },
};
const EMPTY_LIST = { expenses: { categories: [] } };

/** A promise the test settles by hand, to hold the hook mid-save. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush pending promise callbacks inside act(). */
const flush = () => act(async () => {});

async function renderSave() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onSaved = jest.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () =>
      useReceiptScanSave({ bikeName: 'Bike', freeScansLeft: null, scanStartedAt: null, onSaved }),
    { wrapper },
  );
  return { ...hook, onSaved };
}

/** Press the duplicate Alert's button with the given translation key. */
function pressDuplicateButton(alertSpy: jest.SpyInstance, textKey: string) {
  const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
  const button = buttons.find((b) => b.text === textKey);
  button?.onPress?.();
}

let alertSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useReceiptScanSave saving state', () => {
  it('is on for the duplicate lookup and the save, then off once saved', async () => {
    const lookup = deferred<typeof EMPTY_LIST>();
    mockFetchQuery.mockReturnValue(lookup.promise);
    mockGqlFetcher.mockResolvedValue(SAVED);
    const { result, onSaved } = await renderSave();

    let saveDone!: Promise<void>;
    await act(async () => {
      saveDone = result.current.save(HANDOFF, PAYLOAD);
    });
    expect(result.current.saving).toBe(true);

    await act(async () => {
      lookup.resolve(EMPTY_LIST);
      await saveDone;
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('runs the duplicate lookup once and never paused, so offline cannot stall it', async () => {
    mockFetchQuery.mockResolvedValue(EMPTY_LIST);
    mockGqlFetcher.mockResolvedValue(SAVED);
    const { result } = await renderSave();
    await act(async () => {
      await result.current.save(HANDOFF, PAYLOAD);
    });
    expect(mockFetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ retry: false, networkMode: 'always' }),
    );
  });

  it('gives up on a duplicate lookup that never answers and saves anyway', async () => {
    jest.useFakeTimers();
    mockFetchQuery.mockReturnValue(new Promise(() => {})); // offline: never settles
    mockGqlFetcher.mockResolvedValue(SAVED);
    const { result, onSaved } = await renderSave();

    await act(async () => {
      void result.current.save(HANDOFF, PAYLOAD);
    });
    expect(result.current.saving).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(DUPLICATE_CHECK_TIMEOUT_MS);
    });
    await flush();
    expect(mockGqlFetcher).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('is off while the duplicate warning is open, on again after confirming', async () => {
    mockFetchQuery.mockResolvedValue(DUPLICATE_LIST);
    const mutation = deferred<typeof SAVED>();
    mockGqlFetcher.mockReturnValue(mutation.promise);
    const { result, onSaved } = await renderSave();

    let saveDone!: Promise<void>;
    await act(async () => {
      saveDone = result.current.save(HANDOFF, PAYLOAD);
    });
    await flush();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);

    await act(async () => {
      pressDuplicateButton(alertSpy, 'receiptScan.saved.duplicateConfirm');
    });
    await flush();
    expect(result.current.saving).toBe(true);

    await act(async () => {
      mutation.resolve(SAVED);
      await saveDone;
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('is off and saves nothing when the duplicate warning is cancelled', async () => {
    mockFetchQuery.mockResolvedValue(DUPLICATE_LIST);
    const { result, onSaved } = await renderSave();

    let saveDone!: Promise<void>;
    await act(async () => {
      saveDone = result.current.save(HANDOFF, PAYLOAD);
    });
    await flush();
    await act(async () => {
      pressDuplicateButton(alertSpy, 'receiptScan.saved.duplicateCancel');
      await saveDone;
    });
    expect(mockGqlFetcher).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });

  it('is off after a failed save, with the error shown and the card kept open', async () => {
    mockFetchQuery.mockResolvedValue(EMPTY_LIST);
    mockGqlFetcher.mockRejectedValue(new Error('Network request failed'));
    const { result, onSaved } = await renderSave();

    await act(async () => {
      await result.current.save(HANDOFF, PAYLOAD);
    });
    expect(alertSpy).toHaveBeenCalledWith(
      'receiptScan.saved.saveFailed',
      'receiptScan.saved.saveFailedBody',
    );
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
  });
});
