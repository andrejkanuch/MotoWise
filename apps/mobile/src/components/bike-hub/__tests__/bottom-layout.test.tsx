/**
 * The hub's action pill and content inset sit above the floating tab bar, whose
 * height grows with the system text size (its label is not capped — the tab
 * bar is out of this redesign's scope). They follow the bar's MEASURED height,
 * with the default-size constant only until the first layout.
 */
let mockInsetBottom = 34;
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: mockInsetBottom, left: 0, right: 0 }),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useTabBarStore } from '../../../stores/tab-bar.store';
import { hubBottomLayout, useHubBottomLayout } from '../ui/bottom-layout';
import {
  HUB_HEIGHT,
  HUB_LAST_ROW_MARGIN,
  HUB_PILL_CLEARANCE,
  HUB_PILL_GAP,
  HUB_TAB_BAR_HEIGHT,
  HUB_TAB_BAR_MIN_INSET,
} from '../ui/tokens';

const IPHONE_HOME_INDICATOR = 34;
/** Tab bar height at an accessibility text size (AX3+), labels wrapped / scaled up. */
const AX3_TAB_BAR_HEIGHT = 98;

afterEach(() => {
  useTabBarStore.setState({ height: null });
  mockInsetBottom = IPHONE_HOME_INDICATOR;
});

describe('hubBottomLayout', () => {
  it('before the tab bar has laid out, falls back to the default-size height', () => {
    expect(hubBottomLayout(IPHONE_HOME_INDICATOR, null)).toEqual({
      tabBarClearance: IPHONE_HOME_INDICATOR + HUB_TAB_BAR_HEIGHT,
      pillBottom: IPHONE_HOME_INDICATOR + HUB_TAB_BAR_HEIGHT + HUB_PILL_GAP,
      contentInset: IPHONE_HOME_INDICATOR + HUB_TAB_BAR_HEIGHT + HUB_PILL_CLEARANCE,
    });
  });

  it('at a large text size the pill keeps its gap above the taller, measured bar', () => {
    const layout = hubBottomLayout(IPHONE_HOME_INDICATOR, AX3_TAB_BAR_HEIGHT);
    const tabBarTop = IPHONE_HOME_INDICATOR + AX3_TAB_BAR_HEIGHT;
    expect(layout.tabBarClearance).toBe(tabBarTop);
    expect(layout.pillBottom - tabBarTop).toBe(HUB_PILL_GAP);
    expect(layout.contentInset).toBe(tabBarTop + HUB_PILL_CLEARANCE);
  });

  it('with no bottom inset (Android 3-button nav, older iPhones) the bar floats at the minimum inset', () => {
    expect(hubBottomLayout(0, 70).tabBarClearance).toBe(HUB_TAB_BAR_MIN_INSET + 70);
  });

  it('the content clearance is the pill gap + the pill + room for a last row’s chevron', () => {
    expect(HUB_PILL_CLEARANCE).toBe(HUB_PILL_GAP + HUB_HEIGHT.primary + HUB_LAST_ROW_MARGIN);
  });
});

describe('useHubBottomLayout', () => {
  it('follows the height the tab bar reports from onLayout, and ignores a zero layout', async () => {
    const { result } = await renderHook(() => useHubBottomLayout());
    expect(result.current.tabBarClearance).toBe(IPHONE_HOME_INDICATOR + HUB_TAB_BAR_HEIGHT);

    await act(async () => useTabBarStore.getState().setHeight(AX3_TAB_BAR_HEIGHT));
    expect(result.current.pillBottom).toBe(
      IPHONE_HOME_INDICATOR + AX3_TAB_BAR_HEIGHT + HUB_PILL_GAP,
    );

    await act(async () => useTabBarStore.getState().setHeight(0));
    expect(result.current.tabBarClearance).toBe(IPHONE_HOME_INDICATOR + AX3_TAB_BAR_HEIGHT);
  });
});
