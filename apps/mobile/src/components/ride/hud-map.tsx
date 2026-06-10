import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import MapboxGL, { UserTrackingMode } from '@rnmapbox/maps';
import { PostHogMaskView } from 'posthog-react-native';
import { useMemo } from 'react';
import { useColorScheme, View } from 'react-native';
import { MAP_STYLES } from '../../utils/map-styles';

interface HudMapProps {
  waypoints: Waypoint[];
  gpsAccuracy: number;
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

export function HudMap({ waypoints, gpsAccuracy }: HudMapProps) {
  const isDark = useColorScheme() === 'dark';
  const routeGeoJSON = useMemo(() => buildRouteGeoJSON(waypoints), [waypoints]);
  const gpsColor = getGpsColor(gpsAccuracy);

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
      >
        <MapboxGL.Camera
          followUserLocation
          followUserMode={UserTrackingMode.FollowWithCourse}
          followZoomLevel={15}
          animationMode="moveTo"
        />

        <MapboxGL.LocationPuck puckBearing="heading" puckBearingEnabled />

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
    </PostHogMaskView>
  );
}
