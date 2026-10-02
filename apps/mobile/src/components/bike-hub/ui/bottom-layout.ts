import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarStore } from '../../../stores/tab-bar.store';
import {
  HUB_PILL_CLEARANCE,
  HUB_PILL_GAP,
  HUB_TAB_BAR_HEIGHT,
  HUB_TAB_BAR_MIN_INSET,
} from './tokens';

export interface HubBottomLayout {
  /** Distance from the screen's bottom edge to the top of the floating tab bar. */
  tabBarClearance: number;
  /** `bottom` of the floating action pill. */
  pillBottom: number;
  /** Bottom padding of scrolling content, so its last row clears the pill. */
  contentInset: number;
}

/**
 * Where the hub's floating chrome goes, from the bottom safe-area inset and the
 * tab bar's MEASURED height (`null` before its first layout → the default-size
 * fallback). The bar grows with the system text size and its label is not
 * capped, so a fixed height let the pill overlap it at the largest sizes.
 */
export function hubBottomLayout(
  insetBottom: number,
  measuredTabBarHeight: number | null,
): HubBottomLayout {
  const tabBarHeight = measuredTabBarHeight ?? HUB_TAB_BAR_HEIGHT;
  const tabBarClearance = Math.max(insetBottom, HUB_TAB_BAR_MIN_INSET) + tabBarHeight;
  return {
    tabBarClearance,
    pillBottom: tabBarClearance + HUB_PILL_GAP,
    contentInset: tabBarClearance + HUB_PILL_CLEARANCE,
  };
}

/** {@link hubBottomLayout} for the current device: safe-area inset + measured tab bar. */
export function useHubBottomLayout(): HubBottomLayout {
  const insets = useSafeAreaInsets();
  const measured = useTabBarStore((state) => state.height);
  return hubBottomLayout(insets.bottom, measured);
}
