import * as carplay from '../../../../modules/carplay/src';

// --- adapter mock (capture the registered listeners + action dispatcher) ---
jest.mock('../../../../modules/carplay/src', () => ({
  isCarPlayAvailable: true,
  addConnectListener: jest.fn(() => ({ remove: jest.fn() })),
  addDisconnectListener: jest.fn(() => ({ remove: jest.fn() })),
  setActionDispatcher: jest.fn(),
  setInformationLifecycle: jest.fn(),
  isHeadUnitConnected: jest.fn(() => false),
  renderInformation: jest.fn(),
  clearInformation: jest.fn(),
  pushBikeList: jest.fn(),
  updateBikeList: jest.fn(),
  popBikeList: jest.fn(),
}));

// The coordinator reads the forgot-to-stop flag straight from MMKV (the background
// location task writes it with no React tree mounted), which pulls the native
// react-native-mmkv module into this test's import graph. Stub the store so the
// flag is settable per test.
const mockRideStorage = new Map<string, string | number | boolean>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) =>
      typeof mockRideStorage.get(k) === 'string' ? mockRideStorage.get(k) : undefined,
    getNumber: (k: string) =>
      typeof mockRideStorage.get(k) === 'number' ? mockRideStorage.get(k) : undefined,
    getBoolean: (k: string) =>
      typeof mockRideStorage.get(k) === 'boolean' ? mockRideStorage.get(k) : undefined,
    set: (k: string, v: string | number | boolean) => mockRideStorage.set(k, v),
    remove: (k: string) => mockRideStorage.delete(k),
    contains: (k: string) => mockRideStorage.has(k),
    getAllKeys: () => [...mockRideStorage.keys()],
  }),
}));

// Bike-status data seam (coordinator loads the active bike + tasks outside React).
jest.mock('../../../lib/graphql-client', () => ({ gqlFetcher: jest.fn() }));
jest.mock('../../../lib/query-client', () => ({ queryClient: { getQueryData: jest.fn() } }));
jest.mock('@motovault/graphql', () => ({
  MaintenanceTasksByMotorcycleDocument: 'MaintenanceTasksByMotorcycleDocument',
  MyMotorcyclesDocument: 'MyMotorcyclesDocument',
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
  elevationLoss: 320,
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
import { captureException } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryClient } from '../../../lib/query-client';
import * as rideController from '../../ride/ride-controller';
import { __resetCarPlayCoordinator, startCarPlayCoordinator } from '../carplay-coordinator';

const THROTTLE_MS = 10_000; // mirror of the coordinator's internal throttle window
const fireConnect = () => (carplay.addConnectListener as jest.Mock).mock.calls[0][0]();
const fireDisconnect = () => (carplay.addDisconnectListener as jest.Mock).mock.calls[0][0]();
const fireAction = (id: string) => (carplay.setActionDispatcher as jest.Mock).mock.calls[0][0](id);
const fireStore = () => {
  for (const l of [...mockStoreListeners]) l();
};
// The lifecycle ({ onWillAppear, onDidDisappear }) passed to the most recent pushBikeList.
const lastBikeLifecycle = () => (carplay.pushBikeList as jest.Mock).mock.calls.at(-1)?.[1];
// Fire the root ride-panel reappear — the adapter's onDidAppear signal that the pushed
// Bike list left the stack (covers the native CarPlay back button, which never fires
// the list's onPopped).
const fireRidePanelReappear = () =>
  (carplay.setInformationLifecycle as jest.Mock).mock.calls.at(-1)?.[0]?.onDidAppear?.();
// Row {title, detail}[] of the most recent panel render pushed to the head unit.
const lastRenderedItems = (): { title: string; detail: string }[] | undefined =>
  (carplay.renderInformation as jest.Mock).mock.calls.at(-1)?.[0]?.items;
// A cached MyMotorcycles result with one primary bike (overridable per test).
const bikeCache = (over: Record<string, unknown> = {}) => ({
  myMotorcycles: [
    {
      id: 'b1',
      isPrimary: true,
      make: 'Honda',
      model: 'CRF1100L',
      nickname: null,
      currentMileage: 10_000,
      recallCount: 0,
      ...over,
    },
  ],
});
const flush = () => new Promise((r) => setImmediate(r));

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
    // Stop is guarded: the first press arms a confirm, the second ends.
    fireAction('stop');
    expect(rideController.endRideSession).not.toHaveBeenCalled();
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
    fireAction('stop'); // arm
    fireAction('stop'); // confirm

    expect(rideController.buildRideSummaryHref).toHaveBeenCalledWith(summary);
    expect(router.replace).toHaveBeenCalledWith(href);
  });

  it('guards Stop: first press arms a confirm (no end), second press ends', () => {
    startCarPlayCoordinator();
    fireConnect();

    fireAction('stop');
    expect(rideController.endRideSession).not.toHaveBeenCalled();

    fireAction('stop');
    expect(rideController.endRideSession).toHaveBeenCalledTimes(1);
  });

  it('cancels an armed Stop on Keep Riding — the next Stop re-arms instead of ending', () => {
    startCarPlayCoordinator();
    fireConnect();

    fireAction('stop'); // arm
    fireAction('cancelStop'); // keep riding -> disarm
    fireAction('stop'); // arms again (not a confirm)
    expect(rideController.endRideSession).not.toHaveBeenCalled();
  });

  it('auto-disarms an armed Stop after the confirm window', () => {
    jest.useFakeTimers();
    startCarPlayCoordinator();
    fireConnect();

    fireAction('stop'); // arm
    jest.advanceTimersByTime(5_000); // window elapses -> auto-disarm
    fireAction('stop'); // a fresh arm, not a confirm
    expect(rideController.endRideSession).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('opens the bike-status list on the Bike action', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike');
    expect(carplay.pushBikeList).toHaveBeenCalledTimes(1);
  });

  it('does NOT rebuild the ride root while the bike list is open (KTD5)', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike'); // bikeVisible = true
    (carplay.renderInformation as jest.Mock).mockClear();

    // a ride state transition arrives while the panel is covered
    mockRide.recordingSubState = 'stopped';
    fireStore();
    expect(carplay.renderInformation).not.toHaveBeenCalled();
  });

  it('refreshes the ride panel when the bike list is dismissed', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike');
    mockRide.recordingSubState = 'stopped'; // transition missed while covered
    fireStore();
    (carplay.renderInformation as jest.Mock).mockClear();

    lastBikeLifecycle()?.onPopped(); // list popped
    expect(carplay.renderInformation).toHaveBeenCalled(); // rebuilt/refreshed on dismiss
  });

  it('clears the covered flag when the bike list is dismissed via the CarPlay back button', () => {
    // The native back button pops the list WITHOUT firing the list's onPopped (iOS only
    // removes + onPopped a CPAlertTemplate on disappear). The root ride panel reappearing
    // is the signal that recovers the coordinator — without it bikeVisible stays true and
    // every ride-control action is dead.
    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike'); // bikeVisible = true (onPopped will NOT fire on a back-button pop)

    // Back button: only the root panel reappears.
    fireRidePanelReappear();

    // Ride-control actions work again (coordinator no longer suppressing them)...
    fireAction('pause');
    expect(mockRide.pauseRide).toHaveBeenCalledTimes(1);
    // ...and a subsequent Bike tap re-pushes a fresh list (not swallowed by the covered flag).
    (carplay.pushBikeList as jest.Mock).mockClear();
    fireAction('bike');
    expect(carplay.pushBikeList).toHaveBeenCalledTimes(1);
  });

  it('shows "Stop to refresh" and skips fetching while moving (R20)', async () => {
    mockRide.status = 'recording';
    mockRide.recordingSubState = 'moving';
    startCarPlayCoordinator();
    fireConnect();
    // onConnect warms the heads-up snapshot (its own cache-first load) — clear that so
    // this asserts only the bike-LIST load path, which must not fetch while moving (R20).
    (gqlFetcher as jest.Mock).mockClear();
    fireAction('bike');

    lastBikeLifecycle()?.onWillAppear();
    await flush();
    expect(gqlFetcher).not.toHaveBeenCalled();
    expect(carplay.updateBikeList).toHaveBeenCalled();
  });

  it('loads the active (isPrimary) bike from cache + fetches tasks on entry when stopped', async () => {
    mockRide.status = 'recording';
    mockRide.recordingSubState = 'stopped';
    (queryClient.getQueryData as jest.Mock).mockReturnValue(bikeCache({ currentMileage: 16_000 }));
    (gqlFetcher as jest.Mock).mockResolvedValue({ maintenanceTasks: [] });

    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike');
    lastBikeLifecycle()?.onWillAppear();
    await flush();

    // fetched tasks for the active bike, then updated the list
    expect(gqlFetcher).toHaveBeenCalledWith('MaintenanceTasksByMotorcycleDocument', {
      motorcycleId: 'b1',
    });
    expect(carplay.updateBikeList).toHaveBeenCalled();
  });

  it('pops the bike list on disconnect', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike');
    fireDisconnect();
    expect(carplay.popBikeList).toHaveBeenCalled();
  });

  it('ignores ride-control actions while the bike list covers the panel', () => {
    startCarPlayCoordinator();
    fireConnect();
    fireAction('bike'); // bikeVisible = true

    // a late/queued Stop press from the now-covered ride panel must not end the ride
    fireAction('stop');
    fireAction('stop');
    expect(rideController.endRideSession).not.toHaveBeenCalled();
  });

  // --- Heads-up row data (U3): cache-first load off the render hot path ---

  it('surfaces an open recall in the heads-up row after the load resolves', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValue(bikeCache({ recallCount: 2 }));
    (gqlFetcher as jest.Mock).mockResolvedValue({ maintenanceTasks: [] });
    startCarPlayCoordinator();
    fireConnect();
    await flush();
    // Row 4 is the heads-up row; the recall rung wins.
    expect(lastRenderedItems()?.[3]).toEqual({ title: 'Recall', detail: '2 open recalls' });
  });

  it('is cache-first for the active bike (no MyMotorcycles fetch when cached), still loads tasks', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValue(bikeCache());
    (gqlFetcher as jest.Mock).mockResolvedValue({ maintenanceTasks: [] });
    startCarPlayCoordinator();
    fireConnect();
    await flush();
    expect(gqlFetcher).not.toHaveBeenCalledWith('MyMotorcyclesDocument');
    expect(gqlFetcher).toHaveBeenCalledWith('MaintenanceTasksByMotorcycleDocument', {
      motorcycleId: 'b1',
    });
  });

  it('does not fetch heads-up data on every render (loads once on connect)', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValue(bikeCache());
    (gqlFetcher as jest.Mock).mockResolvedValue({ maintenanceTasks: [] });
    startCarPlayCoordinator();
    fireConnect();
    await flush();
    const afterConnect = (gqlFetcher as jest.Mock).mock.calls.length;

    // GPS-tick renders must read the cached snapshot, never re-fetch.
    mockRide.distance = 43_000;
    fireStore();
    mockRide.distance = 44_000;
    fireStore();
    fireStore();
    expect((gqlFetcher as jest.Mock).mock.calls.length).toBe(afterConnect);
  });

  it('degrades to the climb fallback (and reports) when the heads-up load fails', async () => {
    (queryClient.getQueryData as jest.Mock).mockReturnValue(undefined);
    (gqlFetcher as jest.Mock).mockRejectedValue(new Error('network'));
    startCarPlayCoordinator();
    fireConnect();
    await flush();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'carplay-coordinator.loadHeadsUpData' }),
    );
    // Panel still rendered on connect; row 4 falls back to Climb (no recall/overdue signal).
    expect(lastRenderedItems()?.[3]?.title).toBe('Climb');
  });
});
