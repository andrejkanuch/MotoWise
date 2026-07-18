import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import MapboxGL, { type MapState } from '@rnmapbox/maps';
import { LocateFixed } from 'lucide-react-native';
import { PostHogMaskView } from 'posthog-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, useColorScheme, View } from 'react-native';
import { useAuthStore } from '../../stores/auth.store';
import { triggerImpact } from '../../utils/haptics';
import { MAP_STYLES } from '../../utils/map-styles';
import { resolveFollowUserMode } from './hud-map-follow';

interface HudMapProps {
  waypoints: Waypoint[];
  gpsAccuracy: number;
  /**
   * Distance from the bottom of the map to the recenter button, in points.
   * Layout B passes a larger value so the button clears its bottom sheet.
   */
  recenterBottomOffset?: number;
}

function getGpsColor(accuracy: number): string {
  if (accuracy < 50) return palette.success500;
  if (accuracy < 200) return palette.warning500;
  return palette.danger500;
}

function buildRouteGeoJSON(waypoints: Waypoint[]): GeoJSON.FeatureCollection {
  const coordinates: [number, number][] = [];
  for (let i = 0; i < waypoints.length; i++) {
    coordinates.push([waypoints[i].longitude, waypoints[i].latitude]);
  }

  return {
    type: 'FeatureCollection',
    features:
      coordinates.length >= 2
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates,
              },
            },
          ]
        : [],
  };
}

/** A finite, non-negative heading on the latest waypoint means we have a course fix. */
function hasFiniteCourse(waypoints: Waypoint[]): boolean {
  const last = waypoints.at(-1);
  const heading = last?.heading;
  return typeof heading === 'number' && Number.isFinite(heading) && heading >= 0;
}

export function HudMap({ waypoints, gpsAccuracy, recenterBottomOffset = 16 }: HudMapProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const mapOrientation = useAuthStore((s) => s.mapOrientation);
  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(waypoints), [waypoints]);
  const gpsColor = getGpsColor(gpsAccuracy);

  // Course-up only once a finite course has been observed (NaN guard, R4).
  const hasValidCourse = useMemo(() => hasFiniteCourse(waypoints), [waypoints]);
  const followUserMode = resolveFollowUserMode(mapOrientation, hasValidCourse);

  // Follow re-arm: a user pan breaks native follow; the recenter button re-arms it.
  const [isFollowing, setIsFollowing] = useState(true);

  const handleCameraChanged = useCallback((state: MapState) => {
    // A gesture-driven camera change means the user panned/zoomed — stop following
    // so the recenter affordance appears. Programmatic follow updates are ignored.
    if (state.gestures?.isGestureActive) setIsFollowing(false);
  }, []);

  const handleRecenter = useCallback(() => {
    triggerImpact();
    // Flipping followUserLocation false → true re-arms native following and
    // recenters the camera on the rider.
    setIsFollowing(true);
  }, []);

  return (
    // Mask the live GPS track from session replay — `maskAllImages` does not
    // cover native/GPU mapbox surfaces, so the rider's route would otherwise be
    // captured in plaintext. (todo 186)
    <PostHogMaskView style={{ flex: 1, backgroundColor: palette.neutral950 }}>
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLES[isDark ? 'dark' : 'light']}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        onCameraChanged={handleCameraChanged}
      >
        {/*
         * GPS course-based tracking (no compass). North-up uses Follow; heading-up
         * uses FollowWithCourse (rotate by movement course). We never use
         * FollowWithHeading — the compass->bearing transition crashes with
         * "Cannot round NaN value" on low-end sensors (Sentry
         * MOTO-VAULT-REACT-NATIVE-16). resolveFollowUserMode also holds north-up
         * until a finite course exists, so the follow controller never gets NaN.
         */}
        <MapboxGL.Camera
          followUserLocation={isFollowing}
          followUserMode={followUserMode}
          followZoomLevel={15}
          animationMode="moveTo"
        />

        <MapboxGL.LocationPuck puckBearing="course" puckBearingEnabled />

        {routeGeoJSON.features.length > 0 && (
          <MapboxGL.ShapeSource id="route-source" shape={routeGeoJSON} lineMetrics>
            <MapboxGL.LineLayer
              id="route-line"
              style={{
                lineColor: palette.accent500,
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {/* GPS quality indicator */}
      <View
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: gpsColor,
          borderWidth: 2,
          borderColor: palette.surfaceOverlay,
        }}
      />

      {/* Recenter button — only while the map is not following (nothing to re-arm otherwise) */}
      {!isFollowing && (
        <Pressable
          onPress={handleRecenter}
          accessibilityRole="button"
          accessibilityLabel={t('rideHud.recenter', { defaultValue: 'Recenter map' })}
          style={{
            position: 'absolute',
            right: 16,
            bottom: recenterBottomOffset,
            width: 48,
            height: 48,
            borderRadius: 24,
            borderCurve: 'continuous',
            backgroundColor: palette.controlBg,
            borderWidth: 1,
            borderColor: palette.surfaceElevated,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LocateFixed size={22} color={palette.signature500} />
        </Pressable>
      )}
    </PostHogMaskView>
  );
}
