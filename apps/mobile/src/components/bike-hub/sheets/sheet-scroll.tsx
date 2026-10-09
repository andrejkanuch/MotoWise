import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHubTheme } from '../ui/tokens';

/** Room the system keeps between the status bar and a full-height sheet's top edge. */
export const SHEET_TOP_CLEARANCE = 16;

/** Space under the last control of a fit-to-contents sheet. */
export const SHEET_BOTTOM_PADDING = 16;

/**
 * Bottom padding of a fit-to-contents sheet. iOS already lifts a form sheet's
 * content clear of the home indicator, so adding the safe-area inset there left
 * ~70 pt of dead space under Save and under the last Log option. Android draws
 * the sheet edge to edge, behind the navigation bar, so the inset is kept.
 */
export function sheetBottomPadding(bottomInset: number): number {
  if (process.env.EXPO_OS === 'ios') return SHEET_BOTTOM_PADDING;
  return Math.max(bottomInset, SHEET_BOTTOM_PADDING);
}

interface SheetScrollProps {
  children: ReactNode;
  contentContainerStyle: ViewStyle;
  testID?: string;
}

/**
 * The whole content of a fit-to-contents sheet (Log, Odometer). It is exactly as
 * tall as its content until that would pass the top of the screen — at the
 * largest text sizes — and from there it scrolls, so the last control is never
 * out of reach. The title and every row are INSIDE it: a form sheet adopts the
 * first scroll view it finds, and one wrapping a single row was lifted over the
 * title (visual QA round 1).
 *
 * `nestedScrollEnabled`: on Android a form sheet is itself a draggable
 * container, and without it the sheet's drag gesture takes the vertical pan
 * from this scroll view (no-op on iOS).
 */
export function SheetScroll({ children, contentContainerStyle, testID }: SheetScrollProps) {
  const hub = useHubTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={{
        flexGrow: 0,
        maxHeight: height - insets.top - SHEET_TOP_CLEARANCE,
        backgroundColor: hub.card,
      }}
      contentContainerStyle={contentContainerStyle}
      alwaysBounceVertical={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  );
}
