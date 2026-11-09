// Coming back from Settings with location granted again restarts recording; the
// update stream iOS stopped never restarts on its own.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockReadPermission = jest.fn<Promise<string>, []>();
jest.mock('@/utils/ride-permissions', () => ({ readPermissionLevel: () => mockReadPermission() }));
const mockResume = jest.fn<Promise<boolean>, []>(() => Promise.resolve(true));
jest.mock('../ride-controller', () => ({ resumeRecoveredRide: () => mockResume() }));
jest.mock('@/lib/analytics', () => ({ captureException: jest.fn() }));

import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useRideStore } from '@/stores/ride.store';
import { useGpsPermissionRecovery } from '../use-gps-permission-recovery';

let listeners: ((state: string) => void)[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  listeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    listeners.push(listener as (state: string) => void);
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function comeBack() {
  await act(async () => {
    for (const listener of listeners) listener('active');
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useGpsPermissionRecovery', () => {
  it('restarts recording when the rider comes back with permission granted', async () => {
    useRideStore.setState({ gpsPermissionLost: true });
    mockReadPermission.mockResolvedValue('full');
    await renderHook(() => useGpsPermissionRecovery());
    await comeBack();
    expect(mockResume).toHaveBeenCalledTimes(1);
  });

  it('does not try while permission is still off', async () => {
    useRideStore.setState({ gpsPermissionLost: true });
    mockReadPermission.mockResolvedValue('denied');
    await renderHook(() => useGpsPermissionRecovery());
    await comeBack();
    expect(mockReadPermission).toHaveBeenCalled();
    expect(mockResume).not.toHaveBeenCalled();
  });

  it('does not listen at all while permission is fine', async () => {
    useRideStore.setState({ gpsPermissionLost: false });
    await renderHook(() => useGpsPermissionRecovery());
    expect(listeners).toHaveLength(0);
  });
});
