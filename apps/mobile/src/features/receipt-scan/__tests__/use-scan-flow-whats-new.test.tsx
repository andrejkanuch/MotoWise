// Only a scan that reads a receipt counts as using "Scan a receipt", which
// clears its NEW chip. A failed or cancelled scan does not.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('expo-network', () => ({
  getNetworkStateAsync: () => Promise.resolve({ isConnected: true, isInternetReachable: true }),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'client-scan-id' }));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('@/lib/image-upload', () => ({
  takePhoto: () => Promise.resolve('file:///receipt.jpg'),
  pickImage: jest.fn(),
  uploadReceiptPhoto: () => Promise.resolve(),
}));
jest.mock('@/lib/notifications', () => ({ scheduleParkedScanReminder: jest.fn() }));
jest.mock('@/lib/subscription', () => ({ presentPaywall: jest.fn() }));
jest.mock('@/hooks/use-pro-gate', () => ({ useProGate: () => ({ requireAccess: () => true }) }));
jest.mock('../use-receipt-scan-quota', () => ({ useReceiptScanQuota: () => ({ used: 0 }) }));
jest.mock('../durable-receipt-photo', () => ({
  deleteDurablePhoto: jest.fn(),
  persistDurablePhoto: jest.fn(),
}));
jest.mock('../parked-scan-store', () => ({ parkScan: jest.fn() }));
jest.mock('../receipt-scan-queue', () => ({ enqueuePendingScan: jest.fn() }));
jest.mock('../scan-preferences', () => ({
  hasAcceptedScanConsent: () => true,
  setScanConsentAccepted: jest.fn(),
}));

import { CancelReceiptScanDocument, ScanReceiptDocument } from '@motovault/graphql';
import { act, renderHook } from '@testing-library/react-native';
import { WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { trackEvent } from '@/lib/analytics';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { SCAN_ERROR_CODE } from '../scan-flow-constants';
import { useScanFlow } from '../use-scan-flow';

const BIKE = { id: 'bike-1', name: 'Street Glide' };
const SCAN_RESULT = {
  type: 'expense',
  amount: 42,
  currency: 'USD',
  date: '2026-11-01',
  vendor: 'Shell',
  itemName: null,
  category: 'fuel',
  partsCost: null,
  laborCost: null,
  taxAmount: null,
  taxRate: null,
  odometerValue: null,
  odometerUnit: null,
  fuelLitres: null,
  partsNeeded: [],
  legibilityNote: null,
  needsCheck: [],
  lineItems: [],
  fieldConfidence: { amount: 1, currency: 1, date: 1, vendor: 1, category: 1, odometer: 1 },
};

/** Answers each mutation by its document; a scan answer of `null` never arrives. */
function answer(scan: unknown, cancel?: unknown) {
  mockFetcher.mockImplementation((document: unknown) => {
    if (document === ScanReceiptDocument) {
      return scan === null ? new Promise(() => {}) : Promise.resolve(scan);
    }
    if (document === CancelReceiptScanDocument) return Promise.resolve(cancel);
    return Promise.reject(new Error('unexpected document'));
  });
}

async function scanOnce() {
  const { result } = await renderHook(() =>
    useScanFlow({ userId: 'user-1', bikes: [BIKE], quotaLoading: false }),
  );
  await act(async () => {
    await result.current.captureFromCamera();
  });
  return result;
}

const scanUsed = () =>
  useWhatsNewStore.getState().usedFeatures.includes(WHATS_NEW_FEATURE.RECEIPT_SCAN);

beforeEach(() => {
  useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
  mockFetcher.mockReset();
  (trackEvent as jest.Mock).mockReset();
});

describe('a scan marks Scan a receipt used', () => {
  it('when it completes with a read receipt', async () => {
    answer({
      scanReceipt: { __typename: 'ReceiptScanSuccess', scanId: 's-1', result: SCAN_RESULT },
    });
    await scanOnce();
    expect(trackEvent).toHaveBeenCalledWith('RECEIPT_SCAN_COMPLETED', { outcome: 'success' });
    expect(scanUsed()).toBe(true);
  });

  it('not when the scan returns an error', async () => {
    answer({
      scanReceipt: {
        __typename: 'ReceiptScanError',
        code: SCAN_ERROR_CODE.EXTRACTION_FAILED,
        reason: 'unreadable',
      },
    });
    await scanOnce();
    expect(trackEvent).toHaveBeenCalledWith('RECEIPT_SCAN_COMPLETED', {
      outcome: SCAN_ERROR_CODE.EXTRACTION_FAILED,
    });
    expect(scanUsed()).toBe(false);
  });

  it('not when the rider cancels it', async () => {
    answer(null, {
      cancelReceiptScan: { __typename: 'CancelReceiptScanSuccess', scanId: 's-1', status: 'x' },
    });
    const result = await scanOnce();
    await act(async () => {
      await result.current.requestSkip();
    });
    expect(trackEvent).toHaveBeenCalledWith('RECEIPT_SCAN_COMPLETED', { outcome: 'cancelled' });
    expect(scanUsed()).toBe(false);
  });
});
