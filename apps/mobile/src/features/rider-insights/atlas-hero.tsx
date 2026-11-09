import { type MeasurementSystem, mileageUnitLabel } from '@motovault/types';
import MapboxGL from '@rnmapbox/maps';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { logger } from '@/lib/logger';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { MAP_STYLES } from '@/utils/map-styles';
import { decodePolyline } from '@/utils/polyline';
import { plateLettersFor } from './country-codes';
import { fitViewport, metersPerPixel, type Viewport } from './region-tiles';
import {
  distanceParts,
  type RiderInsightsData,
  type RiderInsightsRegion,
} from './use-rider-insights';

/** The hero map is a 4:5 sheet. */
const HERO_ASPECT = 5 / 4;
const MAP_PADDING = 24;
const ROUTE_LINE_WIDTH = 2.5;
const ROUTE_GLOW_WIDTH = 7;
const ROUTE_GLOW_OPACITY = 0.15;
/** Longest the scale bar may be, in logical px. */
const SCALE_MAX_PX = 96;
const SCALE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const SCALE_TICK = 4;
const SCALE_STROKE = 1.5;
const METERS_PER_UNIT = { km: 1000, mi: 1609.344 } as const;
/** Ovals shown before the rest fold into "+N". */
const MAX_OVALS = 6;
const OVAL_HEIGHT = 24;
const OVAL_MIN_WIDTH = 34;
const OVAL_KEYLINE = 1.5;

/** The map layer the ridden routes go beneath, so place names stay readable over them. */
export const ROUTE_BELOW_LAYER = 'road-label-simple';
const STYLES_WITH_ROUTE_BELOW_LAYER: ReadonlySet<string> = new Set([
  MAP_STYLES.light,
  MAP_STYLES.dark,
]);

/**
 * Where the route layer goes. light-v11 and dark-v11 carry `road-label-simple`;
 * on any other style the layer is drawn on top instead, with a warning, because
 * a `belowLayerID` that never appears keeps the routes off the map entirely.
 */
export function routeLayerPlacement(styleURL: string): { belowLayerID?: string } {
  if (STYLES_WITH_ROUTE_BELOW_LAYER.has(styleURL)) return { belowLayerID: ROUTE_BELOW_LAYER };
  logger.warn(`[rider-insights] ${styleURL} has no ${ROUTE_BELOW_LAYER}; routes drawn on top`);
  return {};
}

/** The longest round scale length that fits `SCALE_MAX_PX`, in the rider's unit. */
export function scaleBar(
  viewport: Viewport,
  system: MeasurementSystem,
): { value: number; unit: string; px: number } {
  const unit = mileageUnitLabel(system);
  const unitPx = METERS_PER_UNIT[unit] / metersPerPixel(viewport);
  const value =
    [...SCALE_STEPS].reverse().find((step) => step * unitPx <= SCALE_MAX_PX) ?? SCALE_STEPS[0];
  return { value, unit, px: Math.round(value * unitPx) };
}

interface AtlasHeroProps {
  /** The region on the main map, or null when no ride has a start region. */
  region: RiderInsightsRegion | null;
  totals: RiderInsightsData['totals'];
  countries: RiderInsightsData['countries'];
  /** False when the cached copy has no routes (offline); the map waits for a request. */
  mapAvailable: boolean;
  width: number;
  system: MeasurementSystem;
  regionName: (region: RiderInsightsRegion) => string;
  regionMeta: (region: RiderInsightsRegion) => string;
  onOpenCountries: () => void;
}

/** The season's main region on a quiet map, the ridden network in copper, and the totals band. */
export function AtlasHero({
  region,
  totals,
  countries,
  mapAvailable,
  width,
  system,
  regionName,
  regionMeta,
  onOpenCountries,
}: AtlasHeroProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const height = Math.round(width * HERO_ASPECT);
  const distance = distanceParts(totals.distanceM, system, language);
  const shown = countries.slice(0, MAX_OVALS);
  const countryNames = countries.map((c) => c.name ?? c.isoA2).join(', ');

  return (
    <View
      style={{
        borderRadius: radius.plate,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: t.surface,
      }}
    >
      <View style={{ width, height, backgroundColor: t.surface2 }}>
        <HeroMap
          region={region}
          mapAvailable={mapAvailable}
          width={width}
          height={height}
          system={system}
          regionName={regionName}
        />
      </View>
      <View style={{ padding: space.md, gap: space.xs }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: space.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.xxs }}>
            <Text style={[type.plateCompact, { color: t.ink }]}>{distance.value}</Text>
            <Text style={[type.figureSmall, { color: t.ink2 }]}>{distance.unit}</Text>
          </View>
          {countries.length > 0 ? (
            <Pressable
              testID="country-ovals"
              accessibilityRole="button"
              accessibilityLabel={i18n('riderInsights.countries.a11y', {
                count: countries.length,
                names: countryNames,
              })}
              onPress={onOpenCountries}
              hitSlop={space.xs}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: space.xxs,
                paddingBottom: space.xxs,
              }}
            >
              {shown.map((country) => (
                <Oval key={country.isoA2} label={plateLettersFor(country.isoA2)} />
              ))}
              {countries.length > shown.length ? (
                <Oval label={`+${countries.length - shown.length}`} />
              ) : null}
            </Pressable>
          ) : null}
        </View>
        <Text style={[type.bodyStrong, { color: t.ink }]}>
          {[
            i18n('riderInsights.totals.rides', { count: totals.rides }),
            i18n('riderInsights.totals.countries', { count: totals.countries }),
          ].join(' · ')}
        </Text>
        {region ? (
          <>
            <View style={{ height: 1, backgroundColor: t.line }} />
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                columnGap: space.sm,
              }}
            >
              <Text style={[type.label, { color: t.ink3, flexShrink: 1 }]}>
                {regionName(region)}
              </Text>
              <Text style={[type.subhead, { color: t.ink2, fontVariant: ['tabular-nums'] }]}>
                {regionMeta(region)}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** A country as an oval registration sticker: plate ink on bone, keylined on light grounds. */
function Oval({ label }: { label: string }) {
  const { t, isDark } = useEditorialTheme();
  return (
    <View
      style={{
        minWidth: OVAL_MIN_WIDTH,
        height: OVAL_HEIGHT,
        paddingHorizontal: space.xs,
        borderRadius: OVAL_HEIGHT / 2,
        borderCurve: 'continuous',
        backgroundColor: t.plateReady,
        borderWidth: isDark ? 0 : OVAL_KEYLINE,
        borderColor: t.onPlate,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[type.figureSmall, OVAL_TEXT, { color: t.onPlate }]}>{label}</Text>
    </View>
  );
}

const OVAL_TEXT = { fontSize: 15, lineHeight: 18 } as const;

interface HeroMapProps {
  region: RiderInsightsRegion | null;
  mapAvailable: boolean;
  width: number;
  height: number;
  system: MeasurementSystem;
  regionName: (region: RiderInsightsRegion) => string;
}

function HeroMap({ region, mapAvailable, width, height, system, regionName }: HeroMapProps) {
  const { t: i18n } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const routes = region?.routes;
  // Decoding a season of polylines is the expensive part; redo it only when the routes change.
  const shape = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: (routes ?? []).map((route) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: decodePolyline(route) },
      })),
    }),
    [routes],
  );

  if (!region?.bounds || !mapAvailable) {
    const note = mapAvailable
      ? i18n('riderInsights.hero.noRoutes')
      : i18n('riderInsights.hero.offline');
    return (
      <View
        testID="hero-map-placeholder"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}
      >
        <Text style={[type.subhead, { color: t.ink3, textAlign: 'center' }]}>{note}</Text>
      </View>
    );
  }

  const viewport = fitViewport(region.bounds, width, height, MAP_PADDING);
  const styleURL = isDark ? MAP_STYLES.dark : MAP_STYLES.light;
  const scale = scaleBar(viewport, system);
  const placement = routeLayerPlacement(styleURL);

  return (
    <View
      testID="hero-map"
      accessible
      accessibilityRole="image"
      accessibilityLabel={i18n('riderInsights.hero.mapA11y', {
        count: region.rides,
        region: regionName(region),
      })}
      style={{ flex: 1 }}
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
          centerCoordinate={viewport.center}
          zoomLevel={viewport.zoom}
          animationDuration={0}
        />
        <MapboxGL.ShapeSource id="insights-routes" shape={shape}>
          <MapboxGL.LineLayer
            id="insights-routes-glow"
            {...placement}
            style={{
              lineColor: t.warm,
              lineWidth: ROUTE_GLOW_WIDTH,
              lineOpacity: ROUTE_GLOW_OPACITY,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <MapboxGL.LineLayer
            id="insights-routes-line"
            {...placement}
            style={{
              lineColor: t.warm,
              lineWidth: ROUTE_LINE_WIDTH,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: space.sm,
          bottom: space.sm,
          paddingVertical: space.xxs,
          paddingHorizontal: space.xs,
          borderRadius: space.xs,
          borderCurve: 'continuous',
          backgroundColor: t.surface,
          gap: space.xxs,
        }}
      >
        <View
          style={{
            width: scale.px,
            height: SCALE_TICK,
            borderWidth: SCALE_STROKE,
            borderTopWidth: 0,
            borderColor: t.ink,
          }}
        />
        <Text style={[type.label, { color: t.ink2, fontVariant: ['tabular-nums'] }]}>
          {`${scale.value} ${scale.unit}`}
        </Text>
      </View>
    </View>
  );
}
