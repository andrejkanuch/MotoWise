/**
 * Road Atlas demo: the rider's recent routes draw themselves onto a real map of
 * where they rode (the example loops onto a blank frame), one after another,
 * then the season figure rises in. Under reduced motion the routes are drawn
 * complete. Decorative: the page line says the same in words.
 */

import MapboxGL from '@rnmapbox/maps';
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
import { fitViewport, projectPoint, type Viewport } from '@/features/rider-insights/map-viewport';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { MAP_STYLES } from '@/utils/map-styles';
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

type Point = [number, number];

/** Each projected route as an SVG path with its drawn length. */
function toPaths(routes: readonly RoutePath[], toXY: (latLng: readonly [number, number]) => Point) {
  return routes.map((route): Projected => {
    let length = 0;
    let previous: Point | null = null;
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

function kept(routes: readonly RoutePath[]): RoutePath[] {
  return routes.slice(0, MAX_ROUTES).map(thin);
}

/** [west, south, east, north] around every point, or null when there are none. */
function boundsOf(routes: readonly RoutePath[]): [number, number, number, number] | null {
  const points = routes.flat();
  if (points.length === 0) return null;
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

/**
 * The example loops fitted into a `width` x `height` box. Longitude is scaled by
 * the cosine of the middle latitude, which keeps shapes true at this size.
 */
function projectFlat(routes: readonly RoutePath[], width: number, height: number): Projected[] {
  const shown = kept(routes);
  const bounds = boundsOf(shown);
  if (!bounds) return [];
  const [west, south, east, north] = bounds;
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
  return toPaths(shown, ([lat, lng]) => [
    offsetX + (lng - west) * xScale * unit,
    offsetY + (north - lat) * unit,
  ]);
}

/**
 * The rider's routes on a map camera fitted to them: the same Web Mercator
 * camera the map under them uses, so every line sits on the road it was ridden.
 */
export function projectOnMap(
  routes: readonly RoutePath[],
  width: number,
  height: number,
): { viewport: Viewport; paths: Projected[] } | null {
  const shown = kept(routes);
  const bounds = boundsOf(shown);
  if (!bounds) return null;
  const viewport = fitViewport(bounds, width, height, FRAME_PADDING);
  const paths = toPaths(shown, ([lat, lng]) => projectPoint([lng, lat], viewport, width, height));
  return { viewport, paths };
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
  const { t, isDark } = useEditorialTheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev?.width === width && prev?.height === height ? prev : { width, height },
    );
  };

  const onMap =
    size && data.kind === WHATS_NEW_DATA_KIND.YOUR_DATA
      ? projectOnMap(data.routes, size.width, size.height)
      : null;
  const routes = onMap?.paths ?? (size ? projectFlat(data.routes, size.width, size.height) : []);
  // The rider's routes in copper on their map, as in Rider insights; the example loops quiet ink.
  const stroke = onMap ? t.warm : tint(t.ink, 0.6);
  const styleURL = isDark ? MAP_STYLES.dark : MAP_STYLES.light;

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
    <View testID="whats-new-atlas" style={{ flex: 1 }} onLayout={onLayout}>
      {onMap ? (
        <View
          testID="whats-new-atlas-map"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <MapboxGL.MapView
            key={styleURL}
            style={{ flex: 1 }}
            styleURL={styleURL}
            surfaceView={process.env.EXPO_OS !== 'android'}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
            compassEnabled={false}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <MapboxGL.Camera
              centerCoordinate={onMap.viewport.center}
              zoomLevel={onMap.viewport.zoom}
              animationDuration={0}
            />
          </MapboxGL.MapView>
        </View>
      ) : null}
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
