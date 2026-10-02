import { create } from 'zustand';

interface TabBarState {
  /**
   * The floating tab bar's rendered height, measured by its own `onLayout`
   * (`app/(tabs)/_layout.tsx`). `null` until the first layout. It grows with
   * the system text size, so screens that float content above the bar read
   * this instead of assuming a fixed height.
   */
  height: number | null;
  setHeight: (height: number) => void;
}

export const useTabBarStore = create<TabBarState>()((set) => ({
  height: null,
  setHeight: (height) => {
    // A zero / non-finite layout (unmounted, mid-transition) is not a measurement.
    if (!Number.isFinite(height) || height <= 0) return;
    set({ height });
  },
}));
