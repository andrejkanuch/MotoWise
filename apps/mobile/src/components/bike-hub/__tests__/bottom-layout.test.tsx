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
import {
  TAB_BAR_MIN_INSET,
  tabBarBottomOffset,
  useTabBarStore,
} from '../../../stores/tab-bar.store';
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

  it('measures from the same bottom offset the tab bar itself uses', () => {
    expect(HUB_TAB_BAR_MIN_INSET).toBe(TAB_BAR_MIN_INSET);
    for (const inset of [0, 8, TAB_BAR_MIN_INSET, 20, IPHONE_HOME_INDICATOR]) {
      expect(tabBarBottomOffset(inset)).toBe(Math.max(inset, TAB_BAR_MIN_INSET));
      expect(hubBottomLayout(inset, 70).tabBarClearance).toBe(tabBarBottomOffset(inset) + 70);
    }
  });

  it('the content clearance is the pill gap + the pill + room for a last row’s chevron', () => {
    expect(HUB_PILL_CLEARANCE).toBe(HUB_PILL_GAP + HUB_HEIGHT.primary + HUB_LAST_ROW_MARGIN);
  });
});

/**
 * Where the bottom of a segment's content (its last row) can be brought, as a
 * distance from the screen's bottom edge, once scrolled as far as it goes. The
 * scroll view fills the screen down to its bottom edge (the tab bar and the
 * pill float over it) and pads its content by `contentInset`.
 */
function lastRowLowestReach(viewport: number, content: number, contentInset: number): number {
  const maxOffset = Math.max(0, content + contentInset - viewport);
  return viewport - (content - maxOffset);
}

describe('the last row can always be scrolled clear of the pill', () => {
  // Visual QA round 3: on an uncached Ténéré hub (short content, inline error
  // blocks) the Costs Retry rested at 717–761 under the Log pill (707–759) on an
  // 874 pt screen; a small scroll had to bring it clear.
  const VIEWPORT = 874 - 210; // screen minus the header + segment bar
  const CONTENT = {
    short: 300, // nothing to scroll: sits above the inset on its own
    justOverflowing: 500, // content + inset barely exceed the viewport
    restsUnderPill: 600, // the round-3 case: last row starts out under the pill
    long: 2400,
  } as const;
  const DEVICES = [
    { name: 'home indicator, default text', inset: IPHONE_HOME_INDICATOR, tabBar: null },
    {
      name: 'home indicator, AX3 tab bar',
      inset: IPHONE_HOME_INDICATOR,
      tabBar: AX3_TAB_BAR_HEIGHT,
    },
    { name: 'no inset (Android 3-button)', inset: 0, tabBar: 70 },
  ] as const;

  for (const device of DEVICES) {
    for (const [label, content] of Object.entries(CONTENT)) {
      it(`${device.name}, ${label} content: last row ends a full gap above the pill's top`, () => {
        const layout = hubBottomLayout(device.inset, device.tabBar);
        const pillTop = layout.pillBottom + HUB_HEIGHT.primary;
        const reach = lastRowLowestReach(VIEWPORT, content, layout.contentInset);
        expect(reach).toBeGreaterThanOrEqual(pillTop + HUB_PILL_GAP);
      });
    }
  }

  it('the inset itself is at least the pill top + a gap, at every tab-bar height', () => {
    for (const tabBar of [null, 49, 65, 70, AX3_TAB_BAR_HEIGHT, 140]) {
      for (const inset of [0, 20, IPHONE_HOME_INDICATOR]) {
        const layout = hubBottomLayout(inset, tabBar);
        const pillTop = layout.pillBottom + HUB_HEIGHT.primary;
        expect(layout.contentInset - pillTop).toBeGreaterThanOrEqual(HUB_PILL_GAP);
      }
    }
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
