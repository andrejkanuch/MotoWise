/**
 * Roads I've Ridden — lifetime heatmap + annual recap (P4.1).
 *
 * Paginates every ride the rider owns client-side, decodes their polylines,
 * and stacks them on a world map as low-opacity lines (Strava-style heatmap).
 * The top card is a shareable annual recap keyed off the current year.
 */
import {
  MyRidesForHeatmapDocument,
  type MyRidesForHeatmapQuery,
  type MyRidesForHeatmapQueryVariables,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Flame, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, radius, SYSTEM_WEIGHT, space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';
import { MAP_STYLES } from '../../../utils/map-styles';
import {
  buildAnnualRecap,
  buildHeatmapFeatureCollection,
  buildLifetimeTotals,
  type HeatmapRide,
} from '../../../utils/ride-heatmap';

const PAGE_SIZE = 50;
// Hard cap so a rider with 10k rides doesn't pound the API on mount.
// 20 pages × 50/page ≈ most-recent ~1000 rides, which covers the realistic
// "personal heatmap" ceiling. Rides beyond that show a footer hint.
const MAX_PAGES = 20;

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export default function RideHeatmapScreen() {
  const { t: i18n } = useTranslation();
  const { t: tok, isDark } = useEditorialTheme();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: queryKeys.rides.heatmap,
    queryFn: ({ pageParam }: { pageParam: string | null }) => {
      const variables: MyRidesForHeatmapQueryVariables = {
        first: PAGE_SIZE,
        after: pageParam,
      };
      return gqlFetcher(MyRidesForHeatmapDocument, variables);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: MyRidesForHeatmapQuery) => {
      const pi = lastPage?.myRides?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? null) : null;
    },
  });

  useEffect(() => {
    trackEvent(AnalyticsEvent.HEATMAP_VIEWED);
  }, []);

  const pagesLoaded = data?.pages?.length ?? 0;
  const capReached = pagesLoaded >= MAX_PAGES;

  // Eagerly page until MAX_PAGES. Firing from an effect (not render body) keeps
  // React from queuing a fetch on every re-render — without the cap this was an
  // unbounded loop for riders with large histories.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && pagesLoaded < MAX_PAGES) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, pagesLoaded, fetchNextPage]);

  const allRides: HeatmapRide[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.myRides.edges.map((e) => e.node)),
    [data?.pages],
  );

  // `allRides` is memoed on `data?.pages`, so its reference only changes when a
  // new page lands — keeping FeatureCollection identity stable across
  // same-page re-renders and preserving Mapbox's tile cache between renders.
  const geojson = useMemo(() => buildHeatmapFeatureCollection(allRides), [allRides]);
  const lifetime = useMemo(() => buildLifetimeTotals(allRides), [allRides]);
  const year = new Date().getFullYear();
  const recap = useMemo(() => buildAnnualRecap(allRides, year), [allRides, year]);

  const handleShareRecap = useCallback(async () => {
    const lines = [
      `In ${recap.year} I rode ${formatKm(recap.totalDistanceM)} across ${recap.rideCount} rides.`,
    ];
    if (recap.countries.length > 0) {
      lines.push(`${recap.countries.length} countries: ${recap.countries.join(', ')}`);
    }
    if (recap.longestRide?.name) {
      lines.push(`Top ride: ${recap.longestRide.name} — ${formatKm(recap.longestRide.distanceM)}`);
    }
    lines.push('— via MotoWise');
    await Share.share({ message: lines.join('\n') }).catch(() => {});
  }, [recap]);

  const shareDisabled = recap.rideCount === 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => {
                triggerImpact();
                void handleShareRecap();
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Share year recap"
              accessibilityState={{ disabled: shareDisabled }}
              disabled={shareDisabled}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: shareDisabled ? 0.4 : 1,
              }}
            >
              <Share2 size={20} color={tok.ink} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: tok.bg }}
        contentContainerStyle={{ paddingTop: space.xs, paddingBottom: space.xxxl, gap: space.md }}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View
          style={{
            height: 360,
            marginHorizontal: GUTTER,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: tok.surface,
          }}
        >
          {isLoading && allRides.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={tok.warm} />
            </View>
          ) : geojson.features.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                gap: 10,
              }}
            >
              <Flame size={28} color={tok.ink3} />
              <Text style={[type.subhead, { color: tok.ink3, textAlign: 'center' }]}>
                {i18n('heatmap.emptyMap')}
              </Text>
            </View>
          ) : (
            <MapboxGL.MapView
              style={{ flex: 1 }}
              styleURL={MAP_STYLES[isDark ? 'dark' : 'outdoors']}
              logoEnabled={false}
              attributionEnabled={false}
              scaleBarEnabled={false}
              compassEnabled={false}
            >
              <MapboxGL.Camera
                defaultSettings={{
                  centerCoordinate: [0, 30],
                  zoomLevel: 1.2,
                }}
              />
              <MapboxGL.ShapeSource id="heatmap-source" shape={geojson as never}>
                {/* Single line layer with lineBlur for glow — replaces the
                    previous stacked wide-faded + narrow-bright pair, halving
                    the per-feature overdraw on GPU. */}
                <MapboxGL.LineLayer
                  id="heatmap-line"
                  style={{
                    lineColor: tok.danger,
                    lineWidth: 2,
                    lineOpacity: 0.7,
                    lineBlur: 2.5,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </MapboxGL.ShapeSource>
            </MapboxGL.MapView>
          )}
          {isFetchingNextPage && (
            <Animated.View
              entering={FadeIn.duration(150)}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: tint(tok.surface, 0.92),
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ActivityIndicator size="small" color={tok.ink} />
              <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: tok.ink }]}>
                {i18n('heatmap.loadingRides')}
              </Text>
            </Animated.View>
          )}
          {capReached && hasNextPage && allRides.length > 0 && (
            <View
              style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                right: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                backgroundColor: tint(tok.surface, 0.92),
              }}
            >
              <Text
                style={[
                  type.caption,
                  SYSTEM_WEIGHT.semibold,
                  { color: tok.ink, textAlign: 'center' },
                ]}
              >
                {i18n('heatmap.showingRecent', { count: MAX_PAGES * PAGE_SIZE })}
              </Text>
            </View>
          )}
        </View>

        {/* Lifetime totals */}
        <Animated.View
          entering={FadeInUp.delay(40).duration(250)}
          style={{
            marginHorizontal: GUTTER,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: space.md,
            backgroundColor: tok.surface,
            flexDirection: 'row',
            gap: space.sm,
          }}
        >
          <Stat
            label={i18n('heatmap.rides')}
            value={String(lifetime.rideCount)}
            ink={tok.ink}
            ink3={tok.ink3}
          />
          <Divider color={tok.line} />
          <Stat
            label={i18n('heatmap.lifetime')}
            value={formatKm(lifetime.totalDistanceM)}
            ink={tok.ink}
            ink3={tok.ink3}
          />
          <Divider color={tok.line} />
          <Stat
            label={i18n('heatmap.countries')}
            value={String(lifetime.countries.length)}
            ink={tok.ink}
            ink3={tok.ink3}
          />
        </Animated.View>

        {/* Annual recap */}
        <Animated.View
          entering={FadeInUp.delay(90).duration(280)}
          style={{
            marginHorizontal: GUTTER,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: space.md,
            backgroundColor: tok.surface,
            gap: space.xs,
          }}
        >
          <Text accessibilityRole="header" style={[type.label, { color: tok.ink3 }]}>
            {i18n('heatmap.yearRecap', { year: recap.year })}
          </Text>
          {recap.rideCount === 0 ? (
            <Text style={[type.subhead, { color: tok.ink3 }]}>
              {i18n('heatmap.noRidesThisYear')}
            </Text>
          ) : (
            <>
              <Text style={[type.sectionTitle, { color: tok.ink }]}>
                {i18n('heatmap.recapSummary', {
                  distance: formatKm(recap.totalDistanceM),
                  count: recap.rideCount,
                  countries:
                    recap.countries.length > 0
                      ? i18n('heatmap.recapInCountries', { count: recap.countries.length })
                      : '',
                })}
              </Text>
              {recap.longestRide?.name && (
                <Text style={[type.subhead, { color: tok.ink3 }]}>
                  {i18n('heatmap.topRideLabel')}{' '}
                  <Text style={[SYSTEM_WEIGHT.semibold, { color: tok.ink2 }]}>
                    {recap.longestRide.name}
                  </Text>{' '}
                  {i18n('heatmap.topRideValue', {
                    distance: formatKm(recap.longestRide.distanceM),
                  })}
                </Text>
              )}
              <Pressable
                onPress={() => {
                  triggerImpact();
                  void handleShareRecap();
                }}
                accessibilityRole="button"
                accessibilityLabel="Share recap"
                android_ripple={{ color: tint(tok.onWarm, 0.2) }}
                style={({ pressed }) => ({
                  marginTop: space.xxs,
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.xs,
                  minHeight: 44,
                  paddingHorizontal: space.md,
                  borderRadius: radius.pill,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                  backgroundColor: tok.warm,
                  opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
                })}
              >
                <Share2 size={16} color={tok.onWarm} />
                <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: tok.onWarm }]}>
                  {i18n('heatmap.shareRecap')}
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </>
  );
}

function Stat({
  label,
  value,
  ink,
  ink3,
}: {
  label: string;
  value: string;
  ink: string;
  ink3: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[type.figure, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[type.caption, { color: ink3, marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ width: 1, backgroundColor: color }} />;
}
