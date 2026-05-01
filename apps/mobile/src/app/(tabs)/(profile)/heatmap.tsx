/**
 * Roads I've Ridden — lifetime heatmap + annual recap (P4.1).
 *
 * Paginates every ride the rider owns client-side, decodes their polylines,
 * and stacks them on a world map as low-opacity lines (Strava-style heatmap).
 * The top card is a shareable annual recap keyed off the current year.
 */
import { palette } from '@motovault/design-system';
import {
  MyRidesForHeatmapDocument,
  type MyRidesForHeatmapQuery,
  type MyRidesForHeatmapQueryVariables,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowLeft, Flame, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { useEditorialTheme } from '../../../theme/editorial';
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['rides', 'heatmap'] as const,
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

  return (
    <View style={{ flex: 1, backgroundColor: tok.bg }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={tok.ink} />
        </Pressable>
        <Text
          style={{ flex: 1, color: tok.ink, fontSize: 18, fontWeight: '700' }}
          numberOfLines={1}
        >
          Roads I've ridden
        </Text>
        <Pressable
          onPress={handleShareRecap}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Share year recap"
          disabled={recap.rideCount === 0}
          style={{ opacity: recap.rideCount === 0 ? 0.4 : 1 }}
        >
          <Share2 size={20} color={tok.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Map */}
        <View
          style={{
            height: 360,
            marginHorizontal: 16,
            borderRadius: 20,
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
              <Text style={{ color: tok.ink3, fontSize: 14, textAlign: 'center' }}>
                Your heatmap fills in as you finish rides with GPS tracks.
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
                backgroundColor: palette.surfaceOverlay,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ActivityIndicator size="small" color={palette.white} />
              <Text style={{ color: palette.white, fontSize: 11, fontWeight: '600' }}>
                Loading rides…
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
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: palette.surfaceOverlay,
              }}
            >
              <Text
                style={{
                  color: palette.white,
                  fontSize: 11,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                Showing your most recent ~{MAX_PAGES * PAGE_SIZE} rides
              </Text>
            </View>
          )}
        </View>

        {/* Lifetime totals */}
        <Animated.View
          entering={FadeInUp.delay(40).duration(250)}
          style={{
            marginHorizontal: 16,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 16,
            backgroundColor: tok.surface,
            flexDirection: 'row',
            gap: 12,
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
            marginHorizontal: 16,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 18,
            backgroundColor: tok.surface,
            gap: 10,
          }}
        >
          <Text style={{ color: tok.ink3, fontSize: 12, fontWeight: '700' }}>
            {recap.year} recap
          </Text>
          {recap.rideCount === 0 ? (
            <Text style={{ color: tok.ink3, fontSize: 14, lineHeight: 20 }}>
              No rides yet this year. Once you save a few, we'll surface your longest ride and
              countries ridden here.
            </Text>
          ) : (
            <>
              <Text
                style={{
                  color: tok.ink,
                  fontSize: 20,
                  fontWeight: '800',
                  letterSpacing: -0.3,
                  lineHeight: 26,
                }}
              >
                {formatKm(recap.totalDistanceM)} across {recap.rideCount} rides
                {recap.countries.length > 0 ? ` in ${recap.countries.length} countries` : ''}.
              </Text>
              {recap.longestRide?.name && (
                <Text style={{ color: tok.ink3, fontSize: 14, lineHeight: 20 }}>
                  Top ride: <Text style={{ fontWeight: '700' }}>{recap.longestRide.name}</Text> —{' '}
                  {formatKm(recap.longestRide.distanceM)}.
                </Text>
              )}
              <Pressable
                onPress={handleShareRecap}
                accessibilityRole="button"
                accessibilityLabel="Share recap"
                style={{
                  marginTop: 4,
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: tok.warm2,
                }}
              >
                <Share2 size={14} color={tok.warm} />
                <Text style={{ color: tok.warm, fontSize: 13, fontWeight: '700' }}>
                  Share recap
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
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
      <Text
        style={{
          color: ink,
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: -0.3,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ color: ink3, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ width: 1, backgroundColor: color }} />;
}
