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

// --- ride-controller mock (start/end go through the shared controller now) ---
jest.mock('../../ride/ride-controller', () => ({
  startRideSession: jest.fn(() => Promise.resolve({ ok: true, rideId: 'r1' })),
  endRideSession: jest.fn(() => null),
  buildRideSummaryHref: jest.fn(() => ({ pathname: '/(modals)/ride-summary', params: {} })),
  // Elapsed is derived from persisted timestamps; mirror the store value in tests.
  elapsedRideSeconds: jest.fn(() => 4360),
}));

// Coordinator now routes the phone to the ride-summary on Stop, and logs nav
// failures — mock the imperative router + analytics to avoid the native chains.
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('../../../lib/analytics', () => ({ captureException: jest.fn() }));

// --- store mocks (avoid the MMKV / expo dependency chain) ---
const mockRide = {
  status: 'recording' as 'idle' | 'recording' | 'paused' | 'ended',
  recordingSubState: 'moving' as 'moving' | 'stopped',
  distance: 42_300,
  elapsedTime: 4360,
  elevationGain: 640,
  currentSpeed: 18,
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

import { router } from 'expo-router';
import * as rideController from '../../ride/ride-controller';
import { __resetCarPlayCoordinator, startCarPlayCoordinator } from '../carplay-coordinator';

const THROTTLE_MS = 10_000; // mirror of the coordinator's internal throttle window
const fireConnect = () => (carplay.addConnectListener as jest.Mock).mock.calls[0][0]();
const fireDisconnect = () => (carplay.addDisconnectListener as jest.Mock).mock.calls[0][0]();
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

  it('flushes the latest numeric value at the window boundary when the store goes quiet', () => {
    jest.useFakeTimers();
    const now = 2_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    startCarPlayCoordinator();
    fireConnect();
    (carplay.renderInformation as jest.Mock).mockClear();

    // numeric churn inside the throttle window -> no immediate render, schedules a flush
    mockRide.distance = 42_500;
    fireStore();
    expect(carplay.renderInformation).not.toHaveBeenCalled();

    // advance both the wall clock and the timers past the window -> trailing flush renders once
    spy.mockReturnValue(now + THROTTLE_MS);
    jest.advanceTimersByTime(THROTTLE_MS);
    expect(carplay.renderInformation).toHaveBeenCalledTimes(1);

    spy.mockRestore();
    jest.useRealTimers();
  });

  it('cancels a pending trailing flush on disconnect (no render against a cleared template)', () => {
    jest.useFakeTimers();
    const now = 3_000_000;
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    startCarPlayCoordinator();
    fireConnect();
    (carplay.renderInformation as jest.Mock).mockClear();

    mockRide.distance = 42_500;
    fireStore(); // schedules a trailing flush inside the window
    fireDisconnect(); // onDisconnect clears the timer + drops the store subscription

    spy.mockReturnValue(now + THROTTLE_MS);
    jest.advanceTimersByTime(THROTTLE_MS);
    expect(carplay.renderInformation).not.toHaveBeenCalled();

    spy.mockRestore();
    jest.useRealTimers();
  });

  it('routes head-unit actions through the store + shared controller', () => {
    startCarPlayCoordinator();
    fireConnect();

    fireAction('pause');
    expect(mockRide.pauseRide).toHaveBeenCalledTimes(1);
    fireAction('resume');
    expect(mockRide.resumeRide).toHaveBeenCalledTimes(1);

    // Start/Stop go through the controller (full GPS/sync orchestration), not the
    // bare store actions — a CarPlay start is a Quick Ride (no bike picker).
    fireAction('start');
    expect(rideController.startRideSession).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'carplay', motorcycleId: null }),
    );
    fireAction('stop');
    expect(rideController.endRideSession).toHaveBeenCalledWith('carplay');
  });

  it('routes the phone to the ride-summary when a CarPlay Stop ends a real ride', () => {
    const summary = { rideId: 'ride-cp', distanceM: 8200, durationS: 540 };
    (rideController.endRideSession as jest.Mock).mockReturnValueOnce(summary);
    const href = { pathname: '/(modals)/ride-summary', params: { rideId: 'ride-cp' } };
    (rideController.buildRideSummaryHref as jest.Mock).mockReturnValueOnce(href);

    startCarPlayCoordinator();
    fireConnect();
    fireAction('stop');

    expect(rideController.buildRideSummaryHref).toHaveBeenCalledWith(summary);
    expect(router.replace).toHaveBeenCalledWith(href);
  });
});
