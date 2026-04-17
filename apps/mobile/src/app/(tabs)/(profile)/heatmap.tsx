/**
 * Roads I've Ridden — lifetime heatmap + annual recap (P4.1).
 *
 * Paginates every ride the rider owns client-side, decodes their polylines,
 * and stacks them on a world map as low-opacity lines (Strava-style heatmap).
 * The top card is a shareable annual recap keyed off the current year.
 *
 * We bypass the generated `MyRides` document on purpose: codegen in the
 * sandbox is flaky, and we want `routePolyline` / `region` without forcing
 * the user to run `pnpm generate` before the next push.
 */
import { palette } from '@motovault/design-system';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { parse } from 'graphql';
import { ArrowLeft, Flame, Share2 } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAP_STYLES } from '../../../utils/map-styles';
import {
  type HeatmapRide,
  buildAnnualRecap,
  buildHeatmapFeatureCollection,
  buildLifetimeTotals,
} from '../../../utils/ride-heatmap';
import { gqlFetcher } from '../../../lib/graphql-client';

interface RideHeatmapPage {
  myRides: {
    edges: Array<{ node: HeatmapRide & { id: string; startedAt: string }; cursor: string }>;
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
    totalCount: number;
  };
}

interface RideHeatmapVars {
  first?: number | null;
  after?: string | null;
}

const RideHeatmapDocument = parse(/* GraphQL */ `
  query RideHeatmap($first: Int, $after: String) {
    myRides(first: $first, after: $after) {
      edges {
        node {
          id
          name
          startedAt
          distanceM
          routePolyline
          region
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`) as TypedDocumentNode<RideHeatmapPage, RideHeatmapVars>;

const PAGE_SIZE = 50;

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export default function RideHeatmapScreen() {
  const isDark = useColorScheme().colorScheme === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery<RideHeatmapPage>({
      queryKey: ['rides', 'heatmap'],
      queryFn: ({ pageParam }) =>
        gqlFetcher(RideHeatmapDocument, {
          first: PAGE_SIZE,
          after: (pageParam as string | null) ?? null,
        }),
      initialPageParam: null as string | null,
      getNextPageParam: (lastPage) =>
        lastPage?.myRides.pageInfo.hasNextPage ? lastPage.myRides.pageInfo.endCursor ?? null : null,
    });

  // Eagerly page until we've pulled everything — rider cohorts with thousands
  // of rides would need chunked rendering, but for now we optimise for
  // "personal heatmap <500 rides" which is the realistic ceiling.
  if (hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  const allRides: HeatmapRide[] = useMemo(
    () => (data?.pages ?? []).flatMap((p) => p.myRides.edges.map((e) => e.node)),
    [data?.pages],
  );

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
      lines.push(
        `Top ride: ${recap.longestRide.name} — ${formatKm(recap.longestRide.distanceM)}`,
      );
    }
    lines.push('— via MotoWise');
    await Share.share({ message: lines.join('\n') }).catch(() => {});
  }, [recap]);

  const surfaceColor = isDark ? palette.neutral900 : palette.neutral50;
  const cardColor = isDark ? palette.neutral800 : palette.white;
  const headingColor = isDark ? palette.neutral50 : palette.neutral950;
  const bodyColor = isDark ? palette.neutral300 : palette.neutral600;
  const dividerColor = isDark ? palette.neutral700 : palette.neutral200;

  return (
    <View style={{ flex: 1, backgroundColor: surfaceColor }}>
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
          <ArrowLeft size={22} color={headingColor} />
        </Pressable>
        <Text
          style={{ flex: 1, color: headingColor, fontSize: 18, fontWeight: '700' }}
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
          <Share2 size={20} color={headingColor} />
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
            backgroundColor: cardColor,
          }}
        >
          {isLoading && allRides.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={palette.accent500} />
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
              <Flame size={28} color={palette.neutral400} />
              <Text style={{ color: bodyColor, fontSize: 14, textAlign: 'center' }}>
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
                <MapboxGL.LineLayer
                  id="heatmap-line-glow"
                  style={{
                    lineColor: palette.danger500,
                    lineWidth: 4,
                    lineOpacity: 0.12,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                <MapboxGL.LineLayer
                  id="heatmap-line"
                  style={{
                    lineColor: palette.danger500,
                    lineWidth: 1.5,
                    lineOpacity: 0.55,
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
                backgroundColor: 'rgba(0,0,0,0.55)',
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
        </View>

        {/* Lifetime totals */}
        <Animated.View
          entering={FadeInUp.delay(40).duration(250)}
          style={{
            marginHorizontal: 16,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 16,
            backgroundColor: cardColor,
            flexDirection: 'row',
            gap: 12,
          }}
        >
          <Stat label="Rides" value={String(lifetime.rideCount)} dark={isDark} />
          <Divider color={dividerColor} />
          <Stat
            label="Lifetime"
            value={formatKm(lifetime.totalDistanceM)}
            dark={isDark}
          />
          <Divider color={dividerColor} />
          <Stat
            label="Countries"
            value={String(lifetime.countries.length)}
            dark={isDark}
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
            backgroundColor: cardColor,
            gap: 10,
          }}
        >
          <Text style={{ color: palette.neutral500, fontSize: 12, fontWeight: '700' }}>
            {recap.year} recap
          </Text>
          {recap.rideCount === 0 ? (
            <Text style={{ color: bodyColor, fontSize: 14, lineHeight: 20 }}>
              No rides yet this year. Once you save a few, we'll surface your longest ride
              and countries ridden here.
            </Text>
          ) : (
            <>
              <Text
                style={{
                  color: headingColor,
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
                <Text style={{ color: bodyColor, fontSize: 14, lineHeight: 20 }}>
                  Top ride: <Text style={{ fontWeight: '700' }}>{recap.longestRide.name}</Text>{' '}
                  — {formatKm(recap.longestRide.distanceM)}.
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
                  backgroundColor: isDark
                    ? `${palette.accent500}25`
                    : 'rgba(45,158,120,0.10)',
                }}
              >
                <Share2 size={14} color={palette.accent500} />
                <Text style={{ color: palette.accent500, fontSize: 13, fontWeight: '700' }}>
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

function Stat({ label, value, dark }: { label: string; value: string; dark: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        style={{
          color: dark ? palette.neutral50 : palette.neutral950,
          fontSize: 18,
          fontWeight: '800',
          letterSpacing: -0.3,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={{ color: palette.neutral500, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ width: 1, backgroundColor: color }} />;
}
