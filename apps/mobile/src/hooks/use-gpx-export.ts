import { ExportTripGpxDocument } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system/next';
import * as Haptics from 'expo-haptics';
import { shareAsync } from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

interface UseGpxExportResult {
  /**
   * Export a trip as GPX and open the native share sheet.
   * @param tripId - Trip UUID (unified trips table)
   * @param tripName - Display name for the filename
   * @param country - Country code for the trip (e.g. 'IT')
   * @param region - Region code (e.g. 'trentino-alto-adige')
   * @param slug - Trip slug (e.g. 'stelvio-pass-loop')
   */
  exportAndShare: (
    tripId: string,
    tripName?: string,
    country?: string,
    region?: string,
    slug?: string,
  ) => Promise<void>;
  /** @deprecated Use exportAndShare with tripId instead */
  exportAndShareLegacy: (routeId: string, routeName?: string) => Promise<void>;
  isExporting: boolean;
}

/**
 * Downloads a GPX file via the exportTripGPX GraphQL mutation (returns a signed URL),
 * saves to cache, and opens the native share sheet.
 */
export function useGpxExport(): UseGpxExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const exportAndShare = useCallback(
    async (
      _tripId: string,
      tripName?: string,
      country?: string,
      region?: string,
      slug?: string,
    ) => {
      if (isExporting || !slug || !country || !region) return;
      setIsExporting(true);

      try {
        const result = await gqlFetcher(ExportTripGpxDocument, { slug, country, region });
        const gpxResult = result.exportTripGPX;

        // Check if it's an error response (quota exceeded)
        if ('code' in gpxResult) {
          Alert.alert(
            'Export Limit Reached',
            gpxResult.reason ?? 'Upgrade to Pro for unlimited GPX exports.',
          );
          return;
        }

        // Success — download from signed URL
        const response = await fetch(gpxResult.fileUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        const gpxContent = await response.text();

        const filename = gpxResult.fileName ?? `${(tripName ?? 'trip').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')}-motovault.gpx`;

        const file = new File(Paths.cache, filename);
        if (file.exists) file.delete();
        file.create();
        file.write(gpxContent);

        await shareAsync(file.uri, {
          mimeType: 'application/gpx+xml',
          UTI: 'com.topografix.gpx',
          dialogTitle: 'Share GPX Route',
        });

        // Invalidate quota cache
        queryClient.invalidateQueries({ queryKey: queryKeys.routes.gpxQuota });

        if (process.env.EXPO_OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        trackEvent(AnalyticsEvent.ROUTE_GPX_EXPORTED, { trip_id: _tripId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong';
        Alert.alert('Export Failed', message);
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, queryClient],
  );

  /**
   * @deprecated Legacy REST-based export for old route IDs.
   * Kept for backward compatibility during routes→trips migration.
   */
  const exportAndShareLegacy = useCallback(
    async (routeId: string, routeName?: string) => {
      if (isExporting) return;
      setIsExporting(true);

      try {
        const { buildGqlRequestHeaders } = await import('../lib/gql-auth-session');
        const headers = await buildGqlRequestHeaders();
        const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

        const response = await fetch(`${API_URL}/routes/${routeId}/export.gpx`, { headers });
        if (!response.ok) throw new Error(`Export failed: ${response.status}`);

        const gpxContent = await response.text();
        const filename = routeName
          ? `${routeName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')}-motovault.gpx`
          : 'route-motovault.gpx';

        const file = new File(Paths.cache, filename);
        if (file.exists) file.delete();
        file.create();
        file.write(gpxContent);

        await shareAsync(file.uri, {
          mimeType: 'application/gpx+xml',
          UTI: 'com.topografix.gpx',
          dialogTitle: 'Share GPX Route',
        });

        queryClient.invalidateQueries({ queryKey: queryKeys.routes.gpxQuota });
        trackEvent(AnalyticsEvent.ROUTE_GPX_EXPORTED, { route_id: routeId });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Something went wrong';
        Alert.alert('Export Failed', message);
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting, queryClient],
  );

  return { exportAndShare, exportAndShareLegacy, isExporting };
}
