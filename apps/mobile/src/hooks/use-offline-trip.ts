import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  bboxFromPoints,
  downloadOfflinePack,
  getOfflineMeta,
  type OfflinePackMeta,
  type OfflineProgress,
  removeOfflinePack,
} from '../lib/offline-trips';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { MAP_STYLES } from '../utils/map-styles';

export type OfflineStatus = 'none' | 'downloading' | 'ready' | 'error';

interface UseOfflineTripParams {
  tripId: string | undefined;
  waypoints: Array<{ lat: number; lng: number }>;
}

/**
 * Offline-pack lifecycle for a single trip.
 *
 * - Reads current status from the MMKV registry on mount.
 * - Exposes `download` / `remove` so the UI can drive the flow.
 * - Reports progress from Mapbox while the pack is downloading.
 */
export function useOfflineTrip({ tripId, waypoints }: UseOfflineTripParams) {
  const [meta, setMeta] = useState<OfflinePackMeta | null>(null);
  const [status, setStatus] = useState<OfflineStatus>('none');
  const [progress, setProgress] = useState<OfflineProgress | null>(null);

  useEffect(() => {
    if (!tripId) return;
    const existing = getOfflineMeta(tripId);
    setMeta(existing);
    setStatus(existing ? 'ready' : 'none');
  }, [tripId]);

  const download = useCallback(async () => {
    if (!tripId) return;
    const bbox = bboxFromPoints(waypoints);
    if (!bbox) {
      Alert.alert('Nothing to download', 'This trip has no waypoints yet.');
      return;
    }
    // Download both colour modes? Not yet — one style keeps pack size in check.
    const styleURL = MAP_STYLES.outdoors;
    setStatus('downloading');
    setProgress(null);
    try {
      const completed = await downloadOfflinePack({
        tripId,
        bbox,
        styleURL,
        onProgress: setProgress,
      });
      setMeta(completed);
      setStatus('ready');
      trackEvent(AnalyticsEvent.TRIP_OFFLINE_DOWNLOADED, {
        trip_id: tripId,
        size_bytes: completed.sizeBytes ?? 0,
      });
    } catch (err) {
      setStatus('error');
      Alert.alert(
        'Offline download failed',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  }, [tripId, waypoints]);

  const remove = useCallback(async () => {
    if (!tripId) return;
    await removeOfflinePack(tripId);
    setMeta(null);
    setStatus('none');
    setProgress(null);
    trackEvent(AnalyticsEvent.TRIP_OFFLINE_REMOVED, { trip_id: tripId });
  }, [tripId]);

  return { status, progress, meta, download, remove };
}
