import MapboxGL from '@rnmapbox/maps';
import { Route } from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, type ImageStyle, View, type ViewStyle } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';
import { MAP_STYLES, getDefaultMapStyle } from '../../utils/map-styles';
import { decodePolyline } from '../../utils/polyline';
import { rideStorage } from '../../utils/ride-storage';

interface RideMapThumbnailProps {
  rideId: string;
  routePolyline?: string | null;
  style?: ViewStyle;
}

const CACHE_PREFIX = 'ride-thumb-';

// Global concurrency limiter — max 1 MapView snapshot at a time to prevent OOM
let activeSnapshots = 0;
const MAX_CONCURRENT_SNAPSHOTS = 1;
const snapshotQueue: Array<() => void> = [];

function acquireSnapshotSlot(): Promise<void> {
  if (activeSnapshots < MAX_CONCURRENT_SNAPSHOTS) {
    activeSnapshots++;
    return Promise.resolve();
  }
  return new Promise((resolve) => snapshotQueue.push(resolve));
}

function releaseSnapshotSlot() {
  activeSnapshots--;
  const next = snapshotQueue.shift();
  if (next) {
    activeSnapshots++;
    next();
  }
}

export const RideMapThumbnail = memo(function RideMapThumbnail({
  rideId,
  routePolyline,
  style,
}: RideMapThumbnailProps) {
  const { t, isDark } = useEditorialTheme();
  const mapRef = useRef<MapboxGL.MapView>(null);

  // Check MMKV cache on first render
  const [snapUri, setSnapUri] = useState<string | null>(() => {
    return rideStorage.getString(`${CACHE_PREFIX}${rideId}`) ?? null;
  });

  const routeData = useMemo(() => {
    if (!routePolyline) return null;
    try {
      const coordinates = decodePolyline(routePolyline);
      if (coordinates.length < 2) return null;

      let minLng = coordinates[0][0];
      let maxLng = coordinates[0][0];
      let minLat = coordinates[0][1];
      let maxLat = coordinates[0][1];

      for (const [lng, lat] of coordinates) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates },
          },
        ],
      };

      return {
        geojson,
        bounds: {
          ne: [maxLng + 0.005, maxLat + 0.005] as [number, number],
          sw: [minLng - 0.005, minLat - 0.005] as [number, number],
        },
      };
    } catch {
      return null;
    }
  }, [routePolyline]);

  // Concurrency gate — wait for a slot before rendering MapView
  const [hasSlot, setHasSlot] = useState(false);
  useEffect(() => {
    if (snapUri || !routeData) return; // No need for a slot
    let cancelled = false;
    acquireSnapshotSlot().then(() => {
      if (!cancelled) setHasSlot(true);
    });
    return () => {
      cancelled = true;
      if (hasSlot) releaseSnapshotSlot();
    };
  }, [snapUri, routeData, hasSlot]);

  const handleMapLoaded = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const uri = await mapRef.current.takeSnap(true);
      rideStorage.set(`${CACHE_PREFIX}${rideId}`, uri);
      setSnapUri(uri);
    } catch {
      // Snapshot failed — keep showing the live map
    } finally {
      releaseSnapshotSlot();
      setHasSlot(false);
    }
  }, [rideId]);

  // Cached image available — render it
  if (snapUri) {
    return (
      <Image
        source={{ uri: snapUri }}
        style={[{ backgroundColor: t.surface2 }, style as ImageStyle]}
        resizeMode="cover"
      />
    );
  }

  // No polyline data — show fallback placeholder
  if (!routeData) {
    return (
      <View
        style={[
          {
            backgroundColor: t.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Route size={28} color={t.ink4} />
      </View>
    );
  }

  // Wait for concurrency slot before mounting MapView
  if (!hasSlot) {
    return (
      <View
        style={[{ backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }, style]}
      >
        <Route size={28} color={t.ink4} />
      </View>
    );
  }

  // Render map, take snapshot, then swap to cached image
  const mapStyleKey = getDefaultMapStyle(isDark);

  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <MapboxGL.MapView
        ref={mapRef}
        style={{ width: '100%', height: '100%' }}
        styleURL={MAP_STYLES[mapStyleKey]}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        onDidFinishLoadingMap={handleMapLoaded}
      >
        <MapboxGL.Camera
          bounds={{
            ne: routeData.bounds.ne,
            sw: routeData.bounds.sw,
            paddingTop: 16,
            paddingBottom: 16,
            paddingLeft: 16,
            paddingRight: 16,
          }}
          animationDuration={0}
        />
        <MapboxGL.ShapeSource id={`thumb-src-${rideId}`} shape={routeData.geojson}>
          <MapboxGL.LineLayer
            id={`thumb-line-${rideId}`}
            style={{
              lineColor: t.warm,
              lineWidth: 3,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
    </View>
  );
});
