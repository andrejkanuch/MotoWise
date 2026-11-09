// The one ride clock every surface shows (HUD, tab ride button, CarPlay banner):
// it must tick while recording, hold still while paused, and need no other
// screen to be mounted for it to move.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockElapsed = jest.fn(() => 0);
jest.mock('../ride-controller', () => ({ elapsedRideSeconds: () => mockElapsed() }));

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useRideStore } from '@/stores/ride.store';
import { useRideElapsed } from '../use-ride-elapsed';

beforeEach(() => {
  jest.useFakeTimers();
  mockElapsed.mockReset();
  useRideStore.setState({ status: 'recording' });
  // The clock only ticks in the foreground.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useRideElapsed', () => {
  it('ticks once a second while recording', async () => {
    mockElapsed.mockReturnValue(10);
    const { result } = await renderHook(() => useRideElapsed());
    expect(result.current).toBe(10);
    mockElapsed.mockReturnValue(11);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(11);
  });

  it('holds still while paused, and catches up on resume', async () => {
    mockElapsed.mockReturnValue(42);
    const { result } = await renderHook(() => useRideElapsed());
    await act(async () => {
      useRideStore.setState({ status: 'paused' });
    });
    expect(result.current).toBe(42);
    const callsWhilePaused = mockElapsed.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    // No timer runs while paused.
    expect(mockElapsed.mock.calls.length).toBe(callsWhilePaused);
    expect(result.current).toBe(42);

    mockElapsed.mockReturnValue(43);
    await act(async () => {
      useRideStore.setState({ status: 'recording' });
    });
    expect(result.current).toBe(43);
  });

  it('is 0 with no open ride (idle, or ended waiting for review)', async () => {
    mockElapsed.mockReturnValue(99);
    useRideStore.setState({ status: 'idle' });
    const { result } = await renderHook(() => useRideElapsed());
    expect(result.current).toBe(0);
    await act(async () => {
      useRideStore.setState({ status: 'ended' });
    });
    expect(result.current).toBe(0);
  });
});
