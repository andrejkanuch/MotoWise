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
}

export const useBikeHubStore = create<BikeHubState>()(
  persist(
    (set) => ({
      lastSegmentByBike: {},
      setLastSegment: (bikeId, segment) =>
        set((state) => ({ lastSegmentByBike: { ...state.lastSegmentByBike, [bikeId]: segment } })),
      forgetBike: (bikeId) =>
        set((state) => {
          const { [bikeId]: _removed, ...rest } = state.lastSegmentByBike;
          return { lastSegmentByBike: rest };
        }),
    }),
    {
      name: STORE_ID,
      storage: createJSONStorage(() => createZustandMMKVStorage(STORE_ID)),
    },
  ),
);
