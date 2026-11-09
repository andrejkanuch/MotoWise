// ride-entry projects the persisted ride at bundle start and on every return to
// the foreground, then checks whether the GPS task is running. A ride whose GPS
// stopped is marked interrupted (entry points lead to Resume / End) — unless a
// GPS start began while the check was in flight, which must win.

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
const mockIsRecording = jest.fn<Promise<boolean | null>, []>();
let mockGpsStarts = 0;
let mockStartInFlight = false;
jest.mock('@/utils/ride-location', () => ({
  gpsStartInFlight: () => mockStartInFlight,
  probeLocationRecording: () => mockIsRecording(),
  gpsStartCount: () => mockGpsStarts,
}));
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
  mockGpsStarts = 0;
  mockStartInFlight = false;
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

  it('marks a live ride interrupted when its GPS stopped while the app was away', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    await flush();
    expect(store.getState().recordingInterrupted).toBe(false);
    // The OS stopped the task; this process survived, so no hydrate-from-idle.
    mockIsRecording.mockResolvedValue(false);
    mockAppStateListener?.('active');
    await flush();
    expect(store.getState()).toMatchObject({ status: 'recording', recordingInterrupted: true });
  });

  it('never marks it interrupted when a GPS start began during the check', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    await flush();
    mockIsRecording.mockImplementation(async () => {
      mockGpsStarts++; // a resume started while the task was being asked
      return false;
    });
    mockAppStateListener?.('active');
    await flush();
    expect(store.getState().recordingInterrupted).toBe(false);
  });

  it('changes nothing when the GPS task cannot be asked', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    await flush();
    mockIsRecording.mockResolvedValue(null);
    mockAppStateListener?.('active');
    await flush();
    expect(store.getState().recordingInterrupted).toBe(false);
  });

  it('never marks it interrupted while a GPS start is still under way', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    await flush();
    // The start began before the check and is still between its stop and start.
    mockStartInFlight = true;
    mockIsRecording.mockResolvedValue(false);
    mockAppStateListener?.('active');
    await flush();
    expect(store.getState().recordingInterrupted).toBe(false);
  });

  it('never marks it interrupted when a GPS start is still under way as the answer comes back', async () => {
    mockIsRecording.mockResolvedValue(true);
    const store = loadEntry('recording');
    await flush();
    mockIsRecording.mockImplementation(async () => {
      mockStartInFlight = true; // began (already counted) and has not settled
      return false;
    });
    mockAppStateListener?.('active');
    await flush();
    expect(store.getState().recordingInterrupted).toBe(false);
  });
});
