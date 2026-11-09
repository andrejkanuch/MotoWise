// ride-entry projects the persisted ride at bundle start and on every return to
// the foreground, then confirms whether the GPS task is running. That check may
// only CLEAR "recording interrupted": setting it could overwrite a resume that
// finished while the check was in flight and send a recording ride to Start Ride.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockIsRecording = jest.fn<Promise<boolean>, []>();
jest.mock('@/utils/ride-location', () => ({ isLocationRecording: () => mockIsRecording() }));
jest.mock('@/lib/analytics', () => ({ captureException: jest.fn() }));
let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return { remove: jest.fn() };
    },
  },
}));

type Store = typeof import('@/stores/ride.store').useRideStore;

const flush = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Loads ride-entry in a fresh module registry (its side effects run on import),
 * after `setup` has written the persisted ride into that registry's storage.
 */
function loadEntry(status: 'recording' | 'paused'): Store {
  let store!: Store;
  jest.isolateModules(() => {
    const { rideMMKV } = require('@/utils/ride-storage');
    rideMMKV.setCurrentId('ride-a');
    rideMMKV.setStatus(status);
    store = require('@/stores/ride.store').useRideStore;
    require('../ride-entry');
  });
  return store;
}

beforeEach(() => {
  mockIsRecording.mockReset();
  mockAppStateListener = null;
});

describe('ride-entry', () => {
  it('projects an open ride at bundle start and clears "interrupted" once GPS is confirmed', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    expect(store.getState()).toMatchObject({ status: 'recording', recordingInterrupted: true });
    await flush();
    expect(store.getState().recordingInterrupted).toBe(false);
  });

  it('leaves an unconfirmed ride interrupted, so entry points lead to Resume / End', async () => {
    mockIsRecording.mockResolvedValue(false);
    const store = loadEntry('recording');
    await flush();
    expect(store.getState().recordingInterrupted).toBe(true);
  });

  it('never marks a confirmed, recording ride interrupted on return to the foreground', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    await flush();
    // A resume finished; then a foreground check sees the task as not (yet) running.
    mockIsRecording.mockResolvedValue(false);
    mockAppStateListener?.('active');
    await flush();
    expect(store.getState()).toMatchObject({ status: 'recording', recordingInterrupted: false });
  });
});
