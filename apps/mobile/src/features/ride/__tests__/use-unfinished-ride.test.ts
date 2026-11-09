// Start Ride's unfinished-ride banner acts on the ride it shows — never on a ride
// that replaced it while the screen was open (e.g. one started on CarPlay).

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: { RIDE_ABANDONED: 'ride_abandoned' },
  trackEvent: jest.fn(),
  captureException: jest.fn(),
}));
jest.mock('@/utils/ride-reminders', () => ({
  cancelRideReminders: jest.fn(() => Promise.resolve()),
}));
jest.mock('../ride-controller', () => ({
  buildRideSummaryHref: jest.fn((_summary: unknown, opts?: { recovered?: boolean }) =>
    opts?.recovered ? '/summary-recovered' : '/summary',
  ),
  endRecoveredRide: jest.fn(() => '/summary-ended-now'),
  finalizeEndedRide: jest.fn(),
  readEndedRideSummary: jest.fn(() => ({ rideId: 'ride-a', recovered: true })),
  resumeRecoveredRide: jest.fn(() => Promise.resolve(true)),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useRideStore } from '@/stores/ride.store';
import { clearRideData, rideMMKV } from '@/utils/ride-storage';
import { endRecoveredRide, resumeRecoveredRide } from '../ride-controller';
import { useUnfinishedRide } from '../use-unfinished-ride';

const endRecovered = endRecoveredRide as jest.Mock;
const resume = resumeRecoveredRide as jest.Mock;

function openRide(rideId: string, status: 'recording' | 'paused' | 'ended') {
  rideMMKV.setCurrentId(rideId);
  rideMMKV.setStatus(status);
}

beforeEach(() => {
  jest.clearAllMocks();
  clearRideData('ride-a');
  clearRideData('ride-b');
  useRideStore.setState({ status: 'idle', recordingInterrupted: false });
});

describe('useUnfinishedRide', () => {
  it('offers Review, not Resume, for an ended ride, and reopens it as recovered', async () => {
    openRide('ride-a', 'ended');
    const { result } = await renderHook(() => useUnfinishedRide());
    expect(result.current).toMatchObject({ phase: 'ended', canResume: false });
    await act(async () => result.current.finish());
    expect(mockReplace).toHaveBeenCalledWith('/summary-recovered');
    expect(endRecovered).not.toHaveBeenCalled();
  });

  it('ends a ride left recording after a kill', async () => {
    openRide('ride-a', 'recording');
    const { result } = await renderHook(() => useUnfinishedRide());
    expect(result.current.canResume).toBe(true);
    await act(async () => result.current.finish());
    expect(endRecovered).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/summary-ended-now');
  });

  it('never ends a newer ride that replaced the one the banner showed', async () => {
    openRide('ride-a', 'ended');
    const { result } = await renderHook(() => useUnfinishedRide());
    // The rider starts a new ride on CarPlay while Start Ride is open.
    openRide('ride-b', 'recording');
    useRideStore.setState({ status: 'recording', recordingInterrupted: false });
    await act(async () => result.current.finish());
    expect(endRecovered).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    // The live ride is not "unfinished": the banner goes away, so a second tap
    // cannot end it either.
    expect(result.current.phase).toBeNull();
    await act(async () => result.current.finish());
    expect(endRecovered).not.toHaveBeenCalled();
  });

  it('shows no banner for a ride this app is recording live', async () => {
    openRide('ride-a', 'recording');
    useRideStore.setState({ status: 'recording', recordingInterrupted: false });
    const { result } = await renderHook(() => useUnfinishedRide());
    expect(result.current.phase).toBeNull();
  });

  it('shows Resume / End for an open ride whose GPS is not confirmed', async () => {
    openRide('ride-a', 'recording');
    useRideStore.setState({ status: 'recording', recordingInterrupted: true });
    const { result } = await renderHook(() => useUnfinishedRide());
    expect(result.current).toMatchObject({ phase: 'recording', canResume: true });
  });

  it('never resumes a ride whose phase changed after the banner showed it', async () => {
    openRide('ride-a', 'paused');
    const { result } = await renderHook(() => useUnfinishedRide());
    rideMMKV.setStatus('ended'); // ended from the reminder notification meanwhile
    await act(async () => result.current.resume());
    expect(resume).not.toHaveBeenCalled();
    expect(result.current.canResume).toBe(false);
  });
});
