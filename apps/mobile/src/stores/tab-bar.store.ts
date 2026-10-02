import { create } from 'zustand';

/** The floating tab bar never sits closer than this to the screen's bottom edge. */
export const TAB_BAR_MIN_INSET = 12;

/**
 * The floating tab bar's `bottom`: the safe-area inset, or the minimum where
 * there is none (Android 3-button nav, older iPhones). One source for the bar
 * itself and for screens that float chrome above it.
 */
export function tabBarBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom, TAB_BAR_MIN_INSET);
}

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
