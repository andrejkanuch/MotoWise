import { create } from 'zustand';
import { rideMMKV } from '../utils/ride-storage';

type RideStatus = 'idle' | 'recording' | 'paused' | 'ended';
type RecordingSubState = 'moving' | 'stopped';
type PermissionLevel = 'full' | 'foreground_only' | 'denied';

interface RideState {
  status: RideStatus;
  currentSpeed: number;
  elapsedTime: number;
  distance: number;
  maxSpeed: number;
  maxLeanAngle: number;
  elevationGain: number;
  elevationLoss: number;
  currentAltitude: number;
  maxAltitude: number;
  minAltitude: number;
  stopCount: number;
  recordingSubState: RecordingSubState;
  isNightMode: boolean;
  isBatterySaver: boolean;
  permissionLevel: PermissionLevel;
  startRide: () => void;
  pauseRide: () => void;
  resumeRide: () => void;
  endRide: () => void;
  updateSpeed: (speed: number) => void;
  updateDistance: (distance: number) => void;
  updateElapsedTime: (time: number) => void;
  updateMaxSpeed: (speed: number) => void;
  updateMaxLeanAngle: (angle: number) => void;
  updateElevation: (gain: number, loss: number, current: number, max: number, min: number) => void;
  updateStopCount: (count: number) => void;
  toggleNightMode: () => void;
  toggleBatterySaver: () => void;
  setPermissionLevel: (level: PermissionLevel) => void;
  hydrate: () => void;
}

const INITIAL_STATS = {
  currentSpeed: 0,
  elapsedTime: 0,
  distance: 0,
  maxSpeed: 0,
  maxLeanAngle: 0,
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
  isNightMode: false,
  isBatterySaver: false,
  permissionLevel: 'denied',
  startRide: () =>
    set({
      status: 'recording',
      ...INITIAL_STATS,
      recordingSubState: 'moving',
    }),
  pauseRide: () => {
    rideMMKV.setStatus('paused');
    set({ status: 'paused' });
  },
  resumeRide: () => {
    rideMMKV.setStatus('recording');
    set({ status: 'recording' });
  },
  endRide: () => set({ status: 'ended', currentSpeed: 0 }),
  updateSpeed: (currentSpeed) => set({ currentSpeed }),
  updateDistance: (distance) => set({ distance }),
  updateElapsedTime: (elapsedTime) => set({ elapsedTime }),
  updateMaxSpeed: (maxSpeed) => set((s) => (maxSpeed > s.maxSpeed ? { maxSpeed } : s)),
  updateMaxLeanAngle: (angle) => {
    // Cap at 55° — phone IMU occasionally reports impossible values from vibration
    const capped = Math.min(Math.abs(angle), 55);
    set((s) => (capped > s.maxLeanAngle ? { maxLeanAngle: capped } : s));
  },
  updateElevation: (elevationGain, elevationLoss, currentAltitude, maxAltitude, minAltitude) =>
    set({ elevationGain, elevationLoss, currentAltitude, maxAltitude, minAltitude }),
  updateStopCount: (stopCount) => set({ stopCount }),
  toggleNightMode: () => set((state) => ({ isNightMode: !state.isNightMode })),
  toggleBatterySaver: () => set((state) => ({ isBatterySaver: !state.isBatterySaver })),
  setPermissionLevel: (permissionLevel) => set({ permissionLevel }),
  hydrate: () => {
    // Restore ride state from MMKV on AppState 'active'
    const currentId = rideMMKV.getCurrentId();
    if (!currentId) return;

    const storedStatus = rideMMKV.getStatus();
    const subState = rideMMKV.getRecordingSubState();
    const permLevel = rideMMKV.getPermissionLevel();

    set({
      status: storedStatus ?? 'recording',
      recordingSubState: subState ?? 'moving',
      permissionLevel: permLevel ?? 'denied',
    });
  },
}));
