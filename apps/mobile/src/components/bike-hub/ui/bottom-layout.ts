import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarBottomOffset, useTabBarStore } from '@/stores/tab-bar.store';
import { HUB_PILL_CLEARANCE, HUB_PILL_GAP, HUB_TAB_BAR_HEIGHT } from './tokens';

export interface HubBottomLayout {
  /** Distance from the screen's bottom edge to the top of the floating tab bar. */
  tabBarClearance: number;
  /** `bottom` of the floating action pill. */
  pillBottom: number;
  /**
   * Bottom padding of scrolling content, so its last row scrolls fully clear
   * of the pill (and the tab bar's opaque dock below it). At rest the pill may
   * float over a row — the floating-action pattern; scrolling to the end always
   * reveals it, trailing value and chevron included.
   */
  contentInset: number;
}

/**
 * Where the hub's floating chrome goes, from the bottom safe-area inset and the
 * tab bar's MEASURED height (`null` before its first layout → the default-size
 * fallback). The bar grows with the system text size (its label is capped at
 * the chrome scale but the bar still gets taller), so a fixed height let the
 * pill overlap it at the largest sizes.
 */
export function hubBottomLayout(
  insetBottom: number,
  measuredTabBarHeight: number | null,
): HubBottomLayout {
  const tabBarHeight = measuredTabBarHeight ?? HUB_TAB_BAR_HEIGHT;
  const tabBarClearance = tabBarBottomOffset(insetBottom) + tabBarHeight;
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
