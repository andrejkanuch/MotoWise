import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  TAB_BAR_FALLBACK_HEIGHT,
  tabBarBottomOffset,
  useTabBarStore,
} from '@/stores/tab-bar.store';
import { layout } from '@/theme/spacing';

/**
 * Bottom padding a tab screen's scroll content needs so its last item (a Delete
 * button, a list's final row) scrolls fully clear of the floating tab bar.
 * Reads the bar's MEASURED height — it grows with the system text size — plus
 * its offset from the bottom edge, plus `gap` of breathing room.
 */
export function useTabBarClearance(gap: number = layout.tabBarGap): number {
  const insets = useSafeAreaInsets();
  const measured = useTabBarStore((s) => s.height);
  return tabBarBottomOffset(insets.bottom) + (measured ?? TAB_BAR_FALLBACK_HEIGHT) + gap;
}
