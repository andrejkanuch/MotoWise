import { type ReactNode, useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BIKE_SEGMENT_ORDER, type BikeSegment } from '../../../lib/bike-hub/constants';
import { hub } from '../ui/tokens';

/** Scroll distance over which the header collapses into one row. */
const COLLAPSE_DISTANCE = 40;
const COLLAPSE_SYNC_MS = 150;

function collapseFor(offsetY: number): number {
  'worklet';
  return Math.min(1, Math.max(0, offsetY / COLLAPSE_DISTANCE));
}

export interface SegmentDefinition {
  render: () => ReactNode;
  /** Ground colour of the segment's scroll view. Hub ground by default. */
  background?: string;
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
}

interface SegmentScrollProps extends Omit<SegmentContainerProps, 'active' | 'segments'> {
  segment: BikeSegment;
  isActive: boolean;
  definition: SegmentDefinition;
}

function SegmentScroll({
  segment,
  isActive,
  definition,
  collapse,
  refreshing,
  onRefresh,
  bottomInset,
}: SegmentScrollProps) {
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
    <View
      testID={`segment-panel-${segment}`}
      accessibilityElementsHidden={!isActive}
      importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
      style={{
        flex: 1,
        display: isActive ? 'flex' : 'none',
        backgroundColor: definition.background ?? hub.ground,
      }}
    >
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: bottomInset }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={hub.copper} />
        }
      >
        {definition.render()}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * One scroll view per segment. A segment mounts the first time it is opened and
 * then stays mounted (hidden with `display: 'none'`), so each keeps its own
 * scroll position natively and its queries stay warm.
 */
export function SegmentContainer({ active, segments, ...scrollProps }: SegmentContainerProps) {
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
            definition={segments[segment]}
            {...scrollProps}
          />
        ),
      )}
    </View>
  );
}
