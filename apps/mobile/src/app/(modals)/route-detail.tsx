import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import { RouteDetailDocument, SaveRouteDocument, UnsaveRouteDocument } from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Award,
  Bookmark,
  CloudOff,
  Download,
  Map as MapIcon,
  Share2,
  User,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Share,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { PremiumWaitlistModal } from '../../components/discover/premium-waitlist-modal';
import { ReviewForm } from '../../components/discover/review-form';
import { ReviewList } from '../../components/discover/review-list';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { MAP_STYLES, type MapStyle } from '../../utils/map-styles';
import { formatDistance, formatElevation } from '../../utils/ride-formatters';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Decode Google-encoded polyline string to [lng, lat] for Mapbox */
function decodePolylineToCoords(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lng / 1e5, lat / 1e5]); // Mapbox uses [lng, lat]
  }
  return points;
}

export default function RouteDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [isSaved, setIsSaved] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await gqlFetcher(UnsaveRouteDocument, { routeId });
      } else {
        await gqlFetcher(SaveRouteDocument, { routeId });
      }
    },
    onSuccess: () => {
      setIsSaved((prev) => !prev);
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const _statColor = isDark ? palette.neutral200 : palette.neutral700;
  const sheetBg = isDark ? palette.cardDark : palette.white;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.routes.detail(routeId),
    queryFn: () => gqlFetcher(RouteDetailDocument, { routeId }),
    enabled: !!routeId,
  });

  const route = data?.routeDetail;

  const coordinates = useMemo(() => {
    if (!route?.polyline) return [];
    return decodePolylineToCoords(route.polyline);
  }, [route?.polyline]);

  const bounds = useMemo(() => {
    if (coordinates.length === 0) return undefined;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of coordinates) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [coordinates]);

  const routeGeoJSON = useMemo(() => {
    if (coordinates.length === 0) return null;
    return {
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates },
      properties: {},
    };
  }, [coordinates]);

  const cycleMapStyle = useCallback(() => {
    setMapStyle((prev) =>
      prev === 'dark' ? 'outdoors' : prev === 'outdoors' ? 'satellite' : 'dark',
    );
  }, []);

  const handleExportGPX = useCallback(async () => {
    if (!routeId) return;
    const url = `${API_URL}/routes/${routeId}/export.gpx`;
    await Linking.openURL(url);
  }, [routeId]);

  const handleShare = useCallback(async () => {
    if (!route) return;
    await Share.share({
      message: `Check out this route on MotoVault: ${route.name ?? 'A great ride'}`,
      url: `https://motovault.app/routes/${routeId}`,
    });
  }, [route, routeId]);

  const surfaceLabel =
    route?.surfaceType === 'paved'
      ? 'Paved'
      : route?.surfaceType === 'mixed'
        ? 'Mixed'
        : route?.surfaceType === 'off-road'
          ? 'Off-road'
          : null;

  if (isLoading || !route) {
    return (
      <View
        style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={palette.accent500} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Map */}
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLES[mapStyle]}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        {bounds && (
          <MapboxGL.Camera
            bounds={{
              ...bounds,
              paddingBottom: 200,
              paddingTop: 60,
              paddingLeft: 40,
              paddingRight: 40,
            }}
            animationMode="flyTo"
            animationDuration={500}
          />
        )}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="route-line" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="route-line-layer"
              style={{
                lineColor: palette.accent500,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
        {/* Start point */}
        {coordinates.length > 0 && (
          <MapboxGL.PointAnnotation id="start" coordinate={coordinates[0]}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: palette.success500,
                borderWidth: 2,
                borderColor: palette.white,
              }}
            />
          </MapboxGL.PointAnnotation>
        )}
        {/* End point */}
        {coordinates.length > 1 && (
          <MapboxGL.PointAnnotation id="end" coordinate={coordinates[coordinates.length - 1]}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: palette.accent500,
                borderWidth: 2,
                borderColor: palette.white,
              }}
            />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      {/* Floating controls */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 12,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={palette.white} />
        </Pressable>
      </View>

      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          right: 12,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Pressable
          onPress={cycleMapStyle}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapIcon size={18} color={palette.white} />
        </Pressable>
        <Pressable
          onPress={handleShare}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Share2 size={18} color={palette.white} />
        </Pressable>
      </View>

      {/* Bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['35%', '60%', '90%']}
        index={0}
        backgroundStyle={{ backgroundColor: sheetBg, borderRadius: 24, borderCurve: 'continuous' }}
        handleIndicatorStyle={{ backgroundColor: isDark ? palette.neutral600 : palette.neutral300 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* MotoVault Pick badge */}
          {route.isMotovaultPick && (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: isDark ? palette.neutral900 : palette.neutral100,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                borderCurve: 'continuous',
                alignSelf: 'flex-start',
                marginBottom: 10,
              }}
            >
              <Award size={14} color={isDark ? palette.accent400 : palette.accent500} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: isDark ? palette.accent400 : palette.accent500,
                }}
              >
                MotoVault Pick
              </Text>
            </Animated.View>
          )}

          {/* Route name */}
          <Text style={{ fontSize: 22, fontWeight: '800', color: titleColor, marginBottom: 4 }}>
            {route.name ?? 'Unnamed Route'}
          </Text>

          {/* Contributor */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <User size={14} color={subtitleColor} />
            <Text style={{ fontSize: 13, color: subtitleColor }}>
              by {route.contributor.displayName}
            </Text>
          </View>

          {/* Stats grid */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatBadge
              label="Distance"
              value={formatDistance(route.distanceM, system)}
              isDark={isDark}
            />
            {(route.elevationGainM ?? 0) > 0 && (
              <StatBadge
                label="Elevation"
                value={formatElevation(route.elevationGainM ?? 0, system)}
                isDark={isDark}
              />
            )}
            {surfaceLabel && <StatBadge label="Surface" value={surfaceLabel} isDark={isDark} />}
            {route.ratingAvg != null && route.ratingCount > 0 && (
              <StatBadge
                label="Rating"
                value={`${route.ratingAvg.toFixed(1)} (${route.ratingCount})`}
                isDark={isDark}
              />
            )}
          </View>

          {/* Description / editorial */}
          {(route.editorialDescription ?? route.description) && (
            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: isDark ? palette.neutral300 : palette.neutral600,
                marginBottom: 16,
              }}
            >
              {route.editorialDescription ?? route.description}
            </Text>
          )}

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <ActionButton
              icon={<Download size={16} color={palette.white} />}
              label="Export GPX"
              onPress={handleExportGPX}
              primary
            />
            <ActionButton
              icon={
                <Bookmark
                  size={16}
                  color={isSaved ? palette.white : palette.accent500}
                  fill={isSaved ? palette.white : 'transparent'}
                />
              }
              label={isSaved ? 'Saved' : 'Save'}
              onPress={() => saveMutation.mutate()}
              primary={isSaved}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <ActionButton
              icon={<CloudOff size={16} color={palette.accent500} />}
              label="Offline"
              onPress={() => setShowWaitlist(true)}
            />
            <ActionButton
              icon={<Share2 size={16} color={palette.accent500} />}
              label="Share"
              onPress={handleShare}
            />
          </View>

          {/* Reviews */}
          <ReviewList routeId={routeId} />

          {/* Review form */}
          {showReviewForm ? (
            <ReviewForm routeId={routeId} onSuccess={() => setShowReviewForm(false)} />
          ) : (
            <Pressable
              onPress={() => setShowReviewForm(true)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: palette.accent500,
                alignItems: 'center',
                marginVertical: 12,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
                Leave a Review
              </Text>
            </Pressable>
          )}

          {/* Comments */}
          <CommentList routeId={routeId} />

          {/* Premium waitlist modal */}
          <PremiumWaitlistModal visible={showWaitlist} onClose={() => setShowWaitlist(false)} />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

function StatBadge({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View
      style={{
        backgroundColor: isDark ? palette.surfaceSubtle : palette.neutral100,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderCurve: 'continuous',
      }}
    >
      <Text style={{ fontSize: 11, color: isDark ? palette.neutral500 : palette.neutral400 }}>
        {label}
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '700',
          color: isDark ? palette.white : palette.neutral950,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        borderCurve: 'continuous',
        backgroundColor: primary ? palette.accent500 : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: palette.accent500,
      }}
    >
      {icon}
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: primary ? palette.white : palette.accent500,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
