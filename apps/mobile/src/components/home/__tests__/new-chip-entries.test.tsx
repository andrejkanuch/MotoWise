// The NEW chip on feature entry rows: the scan row shows it only when it is
// not already showing its free-scans or upsell badge, and it goes once the
// feature is used. The Profile What's New row opens What's New as from Profile.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.28.0' }));
jest.mock('@/utils/haptics', () => ({ triggerImpact: jest.fn(), triggerSelection: jest.fn() }));

const mockEntry = { remaining: 3, showFreeBadge: false, showUpsellBadge: false };
jest.mock('@/features/receipt-scan/receipt-scan-entry', () => ({
  useReceiptScanEntry: () => ({ open: jest.fn(), ...mockEntry }),
}));

import { act, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import { SCAN_ENTRY_SURFACE } from '@/features/receipt-scan/scan-flow-constants';
import { featureNewChipTestId } from '@/features/whats-new/feature-new-chip';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { ReceiptScanRow } from '../home-actions';

const SCAN_CHIP = featureNewChipTestId(WHATS_NEW_FEATURE.RECEIPT_SCAN);

beforeEach(() => {
  useWhatsNewStore.setState(useWhatsNewStore.getInitialState(), true);
  Object.assign(mockEntry, { showFreeBadge: false, showUpsellBadge: false });
});

describe('the Home scan row', () => {
  it('shows NEW while scanning is unused and no quota badge is up', async () => {
    await render(<ReceiptScanRow surface={SCAN_ENTRY_SURFACE.HOME} />);
    expect(screen.getByTestId(SCAN_CHIP)).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('hides NEW once a scan has been used', async () => {
    await render(<ReceiptScanRow surface={SCAN_ENTRY_SURFACE.HOME} />);
    await act(async () => useWhatsNewStore.getState().markUsed(WHATS_NEW_FEATURE.RECEIPT_SCAN));
    expect(screen.queryByTestId(SCAN_CHIP)).toBeNull();
  });

  it.each([
    'showFreeBadge',
    'showUpsellBadge',
  ] as const)('shows no NEW beside the quota badge (%s)', async (badge) => {
    mockEntry[badge] = true;
    await render(<ReceiptScanRow surface={SCAN_ENTRY_SURFACE.HOME} />);
    expect(screen.queryByTestId(SCAN_CHIP)).toBeNull();
  });
});
