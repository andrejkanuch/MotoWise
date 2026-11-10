/**
 * Road Atlas demo: the rider's recent routes (or the example loops) draw
 * themselves onto one frame, one after another, then the season figure rises
 * in. Under reduced motion the routes are drawn complete. Decorative: the page
 * line says the same in words.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { WHATS_NEW_DATA_KIND } from '@/data/whats-new-releases';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { ATLAS_LINE, type AtlasPageData } from '../build-boot-snapshot';
import type { RoutePath } from '../whats-new-examples';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Points kept per route, enough for the shape at this size. */
const MAX_POINTS = 120;
/** Routes drawn, newest first; more only add noise at this size. */
const MAX_ROUTES = 20;
const FRAME_PADDING = space.xl;
const STROKE_WIDTH = 3;
const DRAW_MS = 900;
const DRAW_DELAY_MS = 250;
const DRAW_STAGGER_MS = 90;
const STAT_DELAY_MS = 1500;
const STAT_MS = 260;
const DRAW_EASING = Easing.bezier(0.2, 0.7, 0.2, 1);

interface Projected {
  d: string;
  length: number;
}

function thin(route: RoutePath): RoutePath {
  if (route.length <= MAX_POINTS) return route;
  const step = route.length / MAX_POINTS;
  return Array.from({ length: MAX_POINTS }, (_, i) => route[Math.floor(i * step)]).concat([
    route[route.length - 1],
  ]);
}

/**
 * Each route as an SVG path fitted into a `width` x `height` box, with its drawn
 * length. Longitude is scaled by the cosine of the middle latitude, which keeps
 * shapes true at the few kilometres a ride covers.
 */
function project(routes: readonly RoutePath[], width: number, height: number): Projected[] {
  const kept = routes.slice(0, MAX_ROUTES).map(thin);
  const points = kept.flat();
  if (points.length === 0) return [];
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const xScale = Math.cos((((north + south) / 2) * Math.PI) / 180);
  const spanX = (east - west) * xScale;
  const spanY = north - south;
  const innerW = width - 2 * FRAME_PADDING;
  const innerH = height - 2 * FRAME_PADDING;
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? innerH / spanY : Number.POSITIVE_INFINITY,
  );
  const unit = Number.isFinite(scale) ? scale : 0;
  const offsetX = (width - spanX * unit) / 2;
  const offsetY = (height - spanY * unit) / 2;
  const toXY = ([lat, lng]: readonly [number, number]): [number, number] => [
    offsetX + (lng - west) * xScale * unit,
    offsetY + (north - lat) * unit,
  ];
  return kept.map((route) => {
    let length = 0;
    let previous: [number, number] | null = null;
    const d = route
      .map((latLng, i) => {
        const point = toXY(latLng);
        if (previous) length += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        previous = point;
        return `${i === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`;
      })
      .join(' ');
    return { d, length: Math.max(length, 1) };
  });
}

function DrawingRoute({ route, index, color }: { route: Projected; index: number; color: string }) {
  const offset = useSharedValue(route.length);

  useEffect(() => {
    offset.value = withDelay(
      DRAW_DELAY_MS + index * DRAW_STAGGER_MS,
      withTiming(0, { duration: DRAW_MS, easing: DRAW_EASING }),
    );
  }, [offset, index]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <AnimatedPath
      testID="whats-new-atlas-route"
      d={route.d}
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[route.length, route.length]}
      animatedProps={animatedProps}
    />
  );
}

function RisingStat({
  reduceMotion,
  children,
}: {
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withDelay(STAT_DELAY_MS, withTiming(1, { duration: STAT_MS }));
  }, [opacity, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function AtlasDemo({ data, reduceMotion }: { data: AtlasPageData; reduceMotion: boolean }) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev?.width === width && prev?.height === height ? prev : { width, height },
    );
  };

  const routes = size ? project(data.routes, size.width, size.height) : [];
  // The rider's routes in ink, so copper stays for actions; examples quieter still.
  const stroke = data.kind === WHATS_NEW_DATA_KIND.YOUR_DATA ? t.ink : tint(t.ink, 0.6);

  const stat =
    data.kind === WHATS_NEW_DATA_KIND.EXAMPLE
      ? {
          big: tr('whatsNew.features.road_atlas.demo.rides', { count: data.routes.length }),
          small: tr('whatsNew.features.road_atlas.demo.exampleCaption'),
        }
      : data.line === ATLAS_LINE.LAST_RIDES || !data.distance
        ? { big: tr('whatsNew.features.road_atlas.demo.rides', { count: data.rides }), small: null }
        : {
            big: data.distance,
            small: tr('whatsNew.features.road_atlas.demo.rides', { count: data.rides }),
          };

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {size ? (
        <Svg width={size.width} height={size.height}>
          {routes.map((route, index) =>
            reduceMotion ? (
              <Path
                // biome-ignore lint/suspicious/noArrayIndexKey: routes have no id and never reorder.
                key={index}
                testID="whats-new-atlas-route"
                d={route.d}
                fill="none"
                stroke={stroke}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: routes have no id and never reorder.
              <DrawingRoute key={index} route={route} index={index} color={stroke} />
            ),
          )}
        </Svg>
      ) : null}
      <View style={{ position: 'absolute', left: space.sm, bottom: space.sm }}>
        <RisingStat reduceMotion={reduceMotion}>
          <View
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: space.xs,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              backgroundColor: t.surface2,
            }}
          >
            <Text style={[type.figure, { color: t.ink }]}>{stat.big}</Text>
            {stat.small ? (
              <Text style={[type.caption, { color: t.ink2 }]}>{stat.small}</Text>
            ) : null}
          </View>
        </RisingStat>
      </View>
    </View>
  );
}
