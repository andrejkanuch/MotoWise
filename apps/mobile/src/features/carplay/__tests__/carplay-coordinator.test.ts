import * as carplay from '../../../../modules/carplay/src';

// --- adapter mock (capture the registered listeners + action dispatcher) ---
jest.mock('../../../../modules/carplay/src', () => ({
  isCarPlayAvailable: true,
  addConnectListener: jest.fn(() => ({ remove: jest.fn() })),
  addDisconnectListener: jest.fn(() => ({ remove: jest.fn() })),
  setActionDispatcher: jest.fn(),
  isHeadUnitConnected: jest.fn(() => false),
  renderInformation: jest.fn(),
  clearInformation: jest.fn(),
}));

// --- store mocks (avoid the MMKV / expo dependency chain) ---
const mockRide = {
  status: 'recording' as 'idle' | 'recording' | 'paused' | 'ended',
  recordingSubState: 'moving' as 'moving' | 'stopped',
  distance: 42_300,
  elapsedTime: 4360,
  elevationGain: 640,
  pauseRide: jest.fn(),
  resumeRide: jest.fn(),
  startRide: jest.fn(),
  endRide: jest.fn(),
};
const mockStoreListeners: Array<() => void> = [];

jest.mock('../../../stores/ride.store', () => ({
  useRideStore: {
    getState: () => mockRide,
    subscribe: (cb: () => void) => {
      mockStoreListeners.push(cb);
      return () => {
        const i = mockStoreListeners.indexOf(cb);
        if (i >= 0) mockStoreListeners.splice(i, 1);
      };
    },
  },
}));
jest.mock('../../../stores/carplay.store', () => ({
  useCarPlayStore: { getState: () => ({ startMode: 'automatic' }) },
}));
jest.mock('../../../stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ measurementSystem: 'metric' }) },
}));

import { __resetCarPlayCoordinator, startCarPlayCoordinator } from '../carplay-coordinator';

const fireConnect = () => (carplay.addConnectListener as jest.Mock).mock.calls[0][0]();
const fireAction = (id: string) => (carplay.setActionDispatcher as jest.Mock).mock.calls[0][0](id);
const fireStore = () => {
  for (const l of [...mockStoreListeners]) l();
};

describe('carplay-coordinator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetCarPlayCoordinator();
    mockStoreListeners.length = 0;
    mockRide.status = 'recording';
    mockRide.recordingSubState = 'moving';
    mockRide.distance = 42_300;
  });

  afterEach(() => {
    __resetCarPlayCoordinator(); // clear any pending trailing-flush timer
  });

  it('keeps exactly one ride subscription across repeated connects (no leak)', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireConnect(); // cold-start dual path: scene attach + already-connected check
    expect(mockStoreListeners.length).toBe(1);
  });

  it('projects an already-connected head unit on startup', () => {
    (carplay.isHeadUnitConnected as jest.Mock).mockReturnValueOnce(true);
    startCarPlayCoordinator();
    // No didConnect event fired — startup sees the live connection and renders.
    expect(carplay.renderInformation).toHaveBeenCalledTimes(1);
  });

  it('renders the panel on connect (projection, not start)', () => {
    startCarPlayCoordinator();
    fireConnect();
    expect(carplay.renderInformation).toHaveBeenCalledTimes(1);
    expect(mockRide.startRide).not.toHaveBeenCalled();
  });

  it('renders immediately on a state transition (exempt from throttle)', () => {
    startCarPlayCoordinator();
    fireConnect();
    (carplay.renderInformation as jest.Mock).mockClear();

    // recording -> auto-paused: title + actions change, so the adapter re-pushes.
    mockRide.recordingSubState = 'stopped';
    fireStore();

    expect(carplay.renderInformation).toHaveBeenCalledTimes(1);
  });

  it('coalesces numeric-only updates to >=10s', () => {
    const now = 1_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    startCarPlayCoordinator();
    fireConnect();
    (carplay.renderInformation as jest.Mock).mockClear();

    // same state, only distance ticked, <10s later -> no render
    mockRide.distance = 42_500;
    fireStore();
    expect(carplay.renderInformation).not.toHaveBeenCalled();

    // >=10s later -> one render
    spy.mockReturnValue(now + 10_000);
    mockRide.distance = 42_800;
    fireStore();
    expect(carplay.renderInformation).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('routes head-unit actions into the ride engine', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireAction('pause');
    expect(mockRide.pauseRide).toHaveBeenCalledTimes(1);
    fireAction('stop');
    expect(mockRide.endRide).toHaveBeenCalledTimes(1);
  });
});
