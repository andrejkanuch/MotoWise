import type { ReactNode } from 'react';
import { ScrollView, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hub } from '../ui/tokens';

/** Room the system keeps between the status bar and a full-height sheet's top edge. */
export const SHEET_TOP_CLEARANCE = 16;

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
 */
export function SheetScroll({ children, contentContainerStyle, testID }: SheetScrollProps) {
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
    >
      {children}
    </ScrollView>
  );
}
