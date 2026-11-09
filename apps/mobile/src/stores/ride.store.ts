import { create } from 'zustand';
import { aggregateWaypoints } from '../utils/ride-aggregate';
import { RIDE_PHASE, readRideRecord, readStoredWaypoints, rideMMKV } from '../utils/ride-storage';

type RideStatus = 'idle' | 'recording' | 'paused' | 'ended';
type RecordingSubState = 'moving' | 'stopped';
type PermissionLevel = 'full' | 'foreground_only' | 'denied';

interface RideState {
  status: RideStatus;
  currentSpeed: number;
  distance: number;
  maxSpeed: number;
  elevationGain: number;
  elevationLoss: number;
  currentAltitude: number;
  maxAltitude: number;
  minAltitude: number;
  stopCount: number;
  recordingSubState: RecordingSubState;
  /** Stationary long enough that the rider probably forgot to stop (auto-pause
   *  machine). Persisted by the GPS task; projected here for the screens. */
  forgotToStopPending: boolean;
  isNightMode: boolean;
  isBatterySaver: boolean;
  permissionLevel: PermissionLevel;
  /** True once CoreLocation reported kCLErrorDenied mid-ride — the update stream
   *  is dead and the ride is no longer recording. Separate from `permissionLevel`
   *  on purpose: that one is never persisted, so hydrate() always reads 'denied'. */
  gpsPermissionLost: boolean;
  /**
   * The ride is open (recording or paused) but this process has not confirmed
   * the GPS task is running — it was relaunched after a kill. Entry points then
   * lead to Start Ride (Resume / End) instead of a HUD that records nothing.
   */
  recordingInterrupted: boolean;
  /** Projections of the controller's start and end (pause and resume are set
   *  directly by `pauseRideSession` / `resumeRideSession`). */
  startRide: () => void;
  endRide: () => void;
  updateSpeed: (speed: number) => void;
  updateDistance: (distance: number) => void;
  updateMaxSpeed: (speed: number) => void;
  updateElevation: (gain: number, loss: number, current: number, max: number, min: number) => void;
  updateStopCount: (count: number) => void;
  toggleNightMode: () => void;
  setBatterySaver: (enabled: boolean) => void;
  setPermissionLevel: (level: PermissionLevel) => void;
  setGpsPermissionLost: (lost: boolean) => void;
  /**
   * Re-project the persisted ride (`readRideRecord`) onto this store — the store
   * is a view of MMKV, never the other way round. Runs at bundle start (before
   * any surface, CarPlay included, renders), when the app becomes active, and
   * after a ride is saved or discarded.
   */
  hydrate: () => void;
}

const INITIAL_STATS = {
  currentSpeed: 0,
  distance: 0,
  maxSpeed: 0,
  elevationGain: 0,
  elevationLoss: 0,
  currentAltitude: 0,
  maxAltitude: 0,
  minAltitude: 0,
  stopCount: 0,
} as const;

export const useRideStore = create<RideState>()((set) => ({
  status: 'idle',
  ...INITIAL_STATS,
  recordingSubState: 'moving',
  forgotToStopPending: false,
  isNightMode: false,
  isBatterySaver: false,
  permissionLevel: 'denied',
  gpsPermissionLost: false,
  recordingInterrupted: false,
  startRide: () =>
    set({
      status: 'recording',
      ...INITIAL_STATS,
      recordingSubState: 'moving',
      forgotToStopPending: false,
      recordingInterrupted: false,
      // startGPSListener always starts at full accuracy; a previous ride's
      // switch must not show ON over it.
      isBatterySaver: false,
    }),
  endRide: () => set({ status: 'ended', currentSpeed: 0 }),
  updateSpeed: (currentSpeed) => set({ currentSpeed }),
  updateDistance: (distance) => set({ distance }),
  updateMaxSpeed: (maxSpeed) => set((s) => (maxSpeed > s.maxSpeed ? { maxSpeed } : s)),
  updateElevation: (elevationGain, elevationLoss, currentAltitude, maxAltitude, minAltitude) =>
    set({ elevationGain, elevationLoss, currentAltitude, maxAltitude, minAltitude }),
  updateStopCount: (stopCount) => set({ stopCount }),
  toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
  setBatterySaver: (isBatterySaver) => set({ isBatterySaver }),
  setPermissionLevel: (permissionLevel) => set({ permissionLevel }),
  setGpsPermissionLost: (gpsPermissionLost) => set({ gpsPermissionLost }),
  hydrate: () => {
    const record = readRideRecord();
    if (!record) {
      // No ride on the phone (never started, saved, discarded or auto-ended).
      set((state) =>
        state.status === 'idle'
          ? state
          : {
              status: 'idle',
              ...INITIAL_STATS,
              recordingSubState: 'moving',
              forgotToStopPending: false,
              gpsPermissionLost: false,
              recordingInterrupted: false,
            },
      );
      return;
    }

    set((state) => {
      const next = {
        status: record.phase,
        recordingSubState: record.recordingSubState,
        forgotToStopPending: rideMMKV.getForgotToStopPending(),
        permissionLevel: rideMMKV.getPermissionLevel() ?? state.permissionLevel,
        // Written on both sides (ride-location marks it, resetAutoPauseState clears
        // it), so unlike permissionLevel this one is correct by construction.
        gpsPermissionLost: record.gpsPermissionLost,
      };
      // Coming back to a ride this process did not see start (killed, relaunched):
      // seed the totals from what was recorded, so the HUD shows the distance
      // already covered instead of 0. A live process keeps its own, newer stats.
      if (record.phase === RIDE_PHASE.ENDED) return { ...next, recordingInterrupted: false };
      if (state.status !== 'idle') return next;
      // Elevation is not seeded: the HUD's climb comes from the GPS filter's own
      // running totals, which restart at 0 with the listener, so a seeded value
      // would be overwritten by the first fix anyway.
      const totals = aggregateWaypoints(readStoredWaypoints(record.rideId));
      return {
        ...next,
        distance: totals.distanceM,
        maxSpeed: totals.maxSpeedMps,
        // Unconfirmed until ride-entry (or a resume) sees the GPS task running.
        recordingInterrupted: true,
      };
    });
  },
}));
