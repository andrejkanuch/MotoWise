import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  BIKE_SEGMENT,
  BIKE_SEGMENT_ORDER,
  type BikeSegment,
} from '../../../lib/bike-hub/constants';
import { triggerSelection } from '../../../utils/haptics';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FONT,
  HUB_HEIGHT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  hub,
} from './tokens';

export const SEGMENT_LABEL_KEY: Record<BikeSegment, HubCopyKey> = {
  [BIKE_SEGMENT.OVERVIEW]: 'bikeHub.segment.overview',
  [BIKE_SEGMENT.SERVICE]: 'bikeHub.segment.service',
  [BIKE_SEGMENT.COSTS]: 'bikeHub.segment.costs',
  [BIKE_SEGMENT.BIKE]: 'bikeHub.segment.bike',
};

const PILL_SLOP = Math.ceil((HUB_TOUCH_TARGET - HUB_HEIGHT.small) / 2);
/**
 * Pill padding and gap, sized so all four labels fit a 402 pt phone at the
 * chrome cap (Overview · Service + badge · Costs · Bike ≈ 380 pt). Narrower
 * phones or longer translations scroll, with the same 16 pt edge inset at both
 * ends so the last pill never sits on the screen edge.
 */
const PILL_PADDING_X = 12;
const PILL_GAP = 4;
const BAR_INSET_X = 16;
const ANDROID_TAB_HEIGHT = 48;
const INDICATOR_HEIGHT = 2;
const INDICATOR_MS = 200;

export interface SegmentBarProps {
  active: BikeSegment;
  onChange: (segment: BikeSegment) => void;
  /**
   * Overdue tasks of any priority (`countOverdueTasks` — the hub's one count,
   * the same number as Service's "Overdue · N" eyebrow and Overview's "Needs
   * attention · N overdue"). Shown on the Service segment only, hidden at 0.
   */
  serviceBadge?: number;
}

function Badge({ count }: { count: number }) {
  return (
    <View
      style={{
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        backgroundColor: hub.tagCritBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        style={{ fontFamily: HUB_FONT.mono, fontSize: 11, color: hub.late }}
      >
        {count}
      </Text>
    </View>
  );
}

function useSegmentCopy(serviceBadge: number) {
  const { t } = useTranslation();
  return useCallback(
    (segment: BikeSegment) => {
      const label = t(SEGMENT_LABEL_KEY[segment]);
      const badge = segment === BIKE_SEGMENT.SERVICE ? serviceBadge : 0;
      const accessibilityLabel =
        badge > 0 ? t('bikeHub.segment.serviceOverdueA11y', { count: badge }) : label;
      return { label, badge, accessibilityLabel };
    },
    [t, serviceBadge],
  );
}

/** iOS / default: a horizontally scrollable row of 36 px pills. */
function PillBar({ active, onChange, serviceBadge = 0 }: SegmentBarProps) {
  const { t } = useTranslation();
  const copyFor = useSegmentCopy(serviceBadge);
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<BikeSegment, number>>>({});

  // Under large text the bar is wider than the screen: keep the selection visible.
  useEffect(() => {
    const x = offsets.current[active];
    if (x !== undefined)
      scrollRef.current?.scrollTo({ x: Math.max(0, x - BAR_INSET_X), animated: true });
  }, [active]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={t('bikeHub.segment.listA11y')}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        gap: PILL_GAP,
        paddingHorizontal: BAR_INSET_X,
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      {BIKE_SEGMENT_ORDER.map((segment) => {
        const selected = segment === active;
        const { label, badge, accessibilityLabel } = copyFor(segment);
        return (
          <Pressable
            key={segment}
            testID={`segment-${segment}`}
            onLayout={(event: LayoutChangeEvent) => {
              offsets.current[segment] = event.nativeEvent.layout.x;
            }}
            onPress={() => {
              if (selected) return;
              triggerSelection();
              onChange(segment);
            }}
            accessibilityRole="tab"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected }}
            hitSlop={{ top: PILL_SLOP, bottom: PILL_SLOP }}
            style={{
              // Grows with the (capped) label instead of clipping it.
              minHeight: HUB_HEIGHT.small,
              minWidth: 72,
              paddingHorizontal: PILL_PADDING_X,
              borderRadius: HUB_RADIUS.segment,
              borderCurve: 'continuous',
              backgroundColor: selected ? hub.raised : undefined,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              style={{
                fontFamily: HUB_FONT.sansSemiBold,
                fontSize: 13,
                color: selected ? hub.text : hub.dim,
              }}
            >
              {label}
            </Text>
            {badge > 0 ? <Badge count={badge} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Android: Material tabs — 48 dp, equal width, 2 dp copper indicator, ripple. */
function MaterialTabs({ active, onChange, serviceBadge = 0 }: SegmentBarProps) {
  const { t } = useTranslation();
  const copyFor = useSegmentCopy(serviceBadge);
  const [tabWidth, setTabWidth] = useState(0);
  const activeIndex = BIKE_SEGMENT_ORDER.indexOf(active);
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    indicatorX.value = withTiming(activeIndex * tabWidth, { duration: INDICATOR_MS });
  }, [activeIndex, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('bikeHub.segment.listA11y')}
      onLayout={(event: LayoutChangeEvent) =>
        setTabWidth(event.nativeEvent.layout.width / BIKE_SEGMENT_ORDER.length)
      }
      style={{ flexDirection: 'row', height: ANDROID_TAB_HEIGHT }}
    >
      {BIKE_SEGMENT_ORDER.map((segment) => {
        const selected = segment === active;
        const { label, badge, accessibilityLabel } = copyFor(segment);
        return (
          <Pressable
            key={segment}
            testID={`segment-${segment}`}
            onPress={() => {
              if (!selected) onChange(segment);
            }}
            android_ripple={{ color: hub.ripple }}
            accessibilityRole="tab"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              style={{
                fontFamily: HUB_FONT.sansSemiBold,
                fontSize: 14,
                color: selected ? hub.text : hub.dim,
              }}
            >
              {label}
            </Text>
            {badge > 0 ? <Badge count={badge} /> : null}
          </Pressable>
        );
      })}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: tabWidth,
            height: INDICATOR_HEIGHT,
            backgroundColor: hub.copper,
          },
          indicatorStyle,
        ]}
      />
    </View>
  );
}

/**
 * The four segments of the bike hub. Only Service carries a badge (overdue
 * tasks — see `countOverdueTasks`). `accessibilityRole` tablist / tab with the selected
 * state; the badge count is part of the Service tab's label.
 */
export function SegmentBar(props: SegmentBarProps) {
  return process.env.EXPO_OS === 'android' ? <MaterialTabs {...props} /> : <PillBar {...props} />;
}
