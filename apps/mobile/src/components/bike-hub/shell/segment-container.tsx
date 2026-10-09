import { type ReactNode, useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BIKE_SEGMENT_ORDER, type BikeSegment } from '../../../lib/bike-hub/constants';
import { readableWidth } from '../../../theme/type';
import { useHubTheme } from '../ui/tokens';
import { SegmentInteractiveContext } from './segment-interactive';

/** Scroll distance over which the header collapses into one row. */
const COLLAPSE_DISTANCE = 40;
const COLLAPSE_SYNC_MS = 150;

function collapseFor(offsetY: number): number {
  'worklet';
  return Math.min(1, Math.max(0, offsetY / COLLAPSE_DISTANCE));
}

export interface SegmentDefinition {
  render: () => ReactNode;
}

interface SegmentContainerProps {
  active: BikeSegment;
  segments: Record<BikeSegment, SegmentDefinition>;
  /** 0–1, written by the active segment's scroll; drives `BikeHeader`. */
  collapse: SharedValue<number>;
  refreshing: boolean;
  onRefresh: () => void;
  /** Bottom padding of every segment: tab bar + action-pill clearance. */
  bottomInset: number;
  /** False while another screen or sheet sits over the hub. */
  focused?: boolean;
}

interface SegmentScrollProps
  extends Omit<SegmentContainerProps, 'active' | 'segments' | 'focused'> {
  segment: BikeSegment;
  isActive: boolean;
  interactive: boolean;
  definition: SegmentDefinition;
}

function SegmentScroll({
  segment,
  isActive,
  interactive,
  definition,
  collapse,
  refreshing,
  onRefresh,
  bottomInset,
}: SegmentScrollProps) {
  const hub = useHubTheme();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        scrollY.value = event.contentOffset.y;
        if (isActive) collapse.value = collapseFor(event.contentOffset.y);
      },
    },
    [isActive],
  );

  // On becoming active, hand the header this segment's own scroll position.
  useEffect(() => {
    if (!isActive) return;
    collapse.value = withTiming(collapseFor(scrollY.value), { duration: COLLAPSE_SYNC_MS });
  }, [isActive, collapse, scrollY]);

  return (
    // The hiding wrapper is a plain View: `display: 'none'` on it is honoured by
    // the layout engine, and `pointerEvents="none"` keeps a hidden panel from
    // ever receiving a touch even if a platform still hit-tests it. It is also
    // taken out of the accessibility tree. The panel stays mounted in React, so
    // its state and queries survive. Gesture-handler gestures inside it are
    // switched off through `SegmentInteractiveContext` (see segment-interactive.ts).
    <View
      testID={`segment-panel-${segment}`}
      pointerEvents={isActive ? 'auto' : 'none'}
      aria-hidden={!isActive}
      accessibilityElementsHidden={!isActive}
      importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
      style={isActive ? { flex: 1 } : { display: 'none' }}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: hub.ground }}>
        <Animated.ScrollView
          testID={`segment-scroll-${segment}`}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ ...readableWidth, paddingBottom: bottomInset }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={hub.copper} />
          }
        >
          <SegmentInteractiveContext.Provider value={interactive}>
            {definition.render()}
          </SegmentInteractiveContext.Provider>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * One scroll view per segment. A segment mounts the first time it is opened and
 * then stays mounted (hidden with `display: 'none'`), so each keeps its own
 * scroll position natively and its queries stay warm. Each panel shrinks above
 * the keyboard, so the Overview's quick-note field is never covered.
 */
export function SegmentContainer({
  active,
  segments,
  focused = true,
  ...scrollProps
}: SegmentContainerProps) {
  const [mounted, setMounted] = useState<readonly BikeSegment[]>([active]);
  if (!mounted.includes(active)) setMounted([...mounted, active]);

  return (
    <View style={{ flex: 1 }}>
      {BIKE_SEGMENT_ORDER.filter((segment) => segment === active || mounted.includes(segment)).map(
        (segment) => (
          <SegmentScroll
            key={segment}
            segment={segment}
            isActive={segment === active}
            interactive={segment === active && focused}
            definition={segments[segment]}
            {...scrollProps}
          />
        ),
      )}
    </View>
  );
}
