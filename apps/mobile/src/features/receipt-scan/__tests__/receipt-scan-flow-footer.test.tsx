// The way back to What's New sits under the scan only while the rider is still
// choosing what to scan; once a photo is in, it is gone.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('../review-card', () => ({ ReviewCard: () => null }));

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import '@/i18n';
import { ReceiptScanFlow } from '../receipt-scan-flow';
import { SCAN_PHASE, type ScanPhase } from '../scan-flow-constants';
import type { ScanFlow } from '../use-scan-flow';

const noop = () => Promise.resolve();

function flowIn(phase: ScanPhase): ScanFlow {
  return {
    state: { phase, uploadAttempt: 1, handoff: null } as unknown as ScanFlow['state'],
    bikes: [{ id: 'bike-1', name: 'Africa Twin' }],
    bikeName: 'Africa Twin',
    selectBike: () => {},
    acceptConsent: () => {},
    captureFromCamera: noop,
    captureFromLibrary: noop,
    retryUpload: noop,
    retryAnalyze: noop,
    requestSkip: noop,
    parkForLater: noop,
    reviewNow: () => {},
    gateRefused: false,
    scanStartedAt: null,
  };
}

const SHOWN: readonly ScanPhase[] = [SCAN_PHASE.BIKE_PICK, SCAN_PHASE.CONSENT, SCAN_PHASE.CAPTURE];
const HIDDEN: readonly ScanPhase[] = [
  SCAN_PHASE.GATING,
  SCAN_PHASE.UPLOADING,
  SCAN_PHASE.OFFLINE_QUEUED,
  SCAN_PHASE.ANALYZING,
  SCAN_PHASE.PARKED,
];

async function show(phase: ScanPhase) {
  await render(
    <ReceiptScanFlow
      flow={flowIn(phase)}
      onManualEntry={() => {}}
      onClose={() => {}}
      footer={<Text testID="footer">way back</Text>}
    />,
  );
}

describe('ReceiptScanFlow footer', () => {
  it.each(SHOWN)('is shown while choosing what to scan (%s)', async (phase) => {
    await show(phase);
    expect(screen.getByTestId('footer')).toBeTruthy();
  });

  it.each(HIDDEN)('is gone once a photo is in or the flow is busy (%s)', async (phase) => {
    await show(phase);
    expect(screen.queryByTestId('footer')).toBeNull();
  });
});
