import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BikeSegment } from '../lib/bike-hub/constants';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

const STORE_ID = 'bike-hub';

interface BikeHubState {
  /**
   * The segment last used on each bike. Read through `resolveInitialSegment`,
   * which ignores a value this build does not know. Scroll offsets are not
   * persisted — they live in the mounted segment scroll views.
   */
  lastSegmentByBike: Record<string, BikeSegment>;
  setLastSegment: (bikeId: string, segment: BikeSegment) => void;
  /** Drop a bike's entry when the bike is removed. */
  forgetBike: (bikeId: string) => void;
  /**
   * A task another screen (the Notes screen) wants shown on a bike's Service
   * segment. The mounted hub of that bike picks it up and clears it — so the
   * screen can simply go back instead of navigating to a second hub. Not persisted.
   */
  pendingTask: { bikeId: string; taskId: string } | null;
  requestTask: (bikeId: string, taskId: string) => void;
  clearPendingTask: () => void;
}

export const useBikeHubStore = create<BikeHubState>()(
  persist(
    (set) => ({
      lastSegmentByBike: {},
      setLastSegment: (bikeId, segment) =>
        set((state) => ({ lastSegmentByBike: { ...state.lastSegmentByBike, [bikeId]: segment } })),
      pendingTask: null,
      requestTask: (bikeId, taskId) => set({ pendingTask: { bikeId, taskId } }),
      clearPendingTask: () => set({ pendingTask: null }),
      forgetBike: (bikeId) =>
        set((state) => {
          const { [bikeId]: _removed, ...rest } = state.lastSegmentByBike;
          return { lastSegmentByBike: rest };
        }),
    }),
    {
      name: STORE_ID,
      storage: createJSONStorage(() => createZustandMMKVStorage(STORE_ID)),
      partialize: (state) => ({ lastSegmentByBike: state.lastSegmentByBike }),
    },
  ),
);
