// The phone CarPlay banner's state and numbers per ride status: the rider's own
// pause must read PAUSED (not the GPS's AUTO-PAUSED), and an ended ride must show
// what was saved, not live zeros.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('../../../../modules/carplay/src', () => ({
  addConnectListener: jest.fn(),
  addDisconnectListener: jest.fn(),
  addPhoneSceneVisibilityListener: jest.fn(),
  isCarPlayAvailable: false,
  isHeadUnitConnected: () => false,
}));
jest.mock('@/hooks/use-measurement-system', () => ({ useMeasurementSystem: () => 'metric' }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }));
jest.mock('@/lib/query-options', () => ({ motorcyclesOptions: () => ({}) }));
const mockSummary = jest.fn<unknown, []>(() => null);
jest.mock('../../ride/ride-controller', () => ({ readEndedRideSummary: () => mockSummary() }));
jest.mock('../../ride/use-ride-elapsed', () => ({ useRideElapsed: () => 125 }));

import { renderHook } from '@testing-library/react-native';
import { useCarPlayStore } from '@/stores/carplay.store';
import { useRideStore } from '@/stores/ride.store';
import { useLiveRideSnapshot } from '../use-carplay';

type Status = 'idle' | 'recording' | 'paused' | 'ended';

beforeEach(() => {
  mockSummary.mockReturnValue(null);
  useRideStore.setState({ distance: 5000, elevationGain: 0, recordingSubState: 'moving' });
});

describe('useLiveRideSnapshot', () => {
  const cases: [Status, 'moving' | 'stopped', 'manual' | 'automatic', string, boolean][] = [
    ['recording', 'moving', 'manual', 'recording', true],
    ['recording', 'stopped', 'manual', 'autoPaused', true],
    ['paused', 'stopped', 'manual', 'paused', true],
    ['ended', 'moving', 'manual', 'saved', true],
    ['idle', 'moving', 'automatic', 'armedAuto', false],
    ['idle', 'moving', 'manual', 'manualIdle', false],
  ];

  it.each(cases)('%s / %s / %s → %s', async (status, subState, startMode, banner, active) => {
    useRideStore.setState({ status, recordingSubState: subState });
    useCarPlayStore.setState({ startMode });
    const { result } = await renderHook(() => useLiveRideSnapshot());
    expect(result.current.bannerState).toBe(banner);
    expect(result.current.active).toBe(active);
  });

  it('shows a saved ride with the stored summary, not the live values', async () => {
    mockSummary.mockReturnValue({ distanceM: 42_300, movingTimeS: 3_600, elevationGain: 640 });
    useRideStore.setState({ status: 'ended' });
    const { result } = await renderHook(() => useLiveRideSnapshot());
    expect(result.current.distance).toBe('42 km');
    expect(result.current.elapsed).toBe('01:00:00');
  });

  it('uses the live clock while riding', async () => {
    useRideStore.setState({ status: 'recording' });
    const { result } = await renderHook(() => useLiveRideSnapshot());
    expect(result.current.elapsed).toBe('00:02:05');
    expect(result.current.distance).toContain('5');
  });
});
