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
  toggleNightMode: () => void;
  toggleBatterySaver: () => void;
  setPermissionLevel: (level: PermissionLevel) => void;
  hydrate: () => void;
}

export const useRideStore = create<RideState>()((set) => ({
  status: 'idle',
  currentSpeed: 0,
  elapsedTime: 0,
  distance: 0,
  recordingSubState: 'moving',
  isNightMode: false,
  isBatterySaver: false,
  permissionLevel: 'denied',
  startRide: () =>
    set({
      status: 'recording',
      currentSpeed: 0,
      elapsedTime: 0,
      distance: 0,
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
