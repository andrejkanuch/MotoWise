import { useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system/next';
import * as Haptics from 'expo-haptics';
import { shareAsync } from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { buildGqlRequestHeaders } from '../lib/gql-auth-session';
import { queryKeys } from '../lib/query-keys';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

interface UseGpxExportResult {
  exportAndShare: (routeId: string, routeName?: string) => Promise<void>;
  isExporting: boolean;
}

/**
 * Downloads a GPX file from the REST endpoint, saves to cache,
 * and opens the native share sheet.
 */
export function useGpxExport(): UseGpxExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const exportAndShare = useCallback(
    async (routeId: string, routeName?: string) => {
      if (isExporting) return;
      setIsExporting(true);

      try {
        // Build auth headers for REST call
        const headers = await buildGqlRequestHeaders();

        const response = await fetch(`${API_URL}/routes/${routeId}/export.gpx`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Export failed: ${response.status}`);
        }

        const gpxContent = await response.text();

        // Extract filename from Content-Disposition or build one
        const disposition = response.headers.get('Content-Disposition');
        let filename = 'route-motovault.gpx';
        if (disposition) {
          const match = disposition.match(/filename="?([^";\s]+)"?/);
          if (match) filename = match[1];
        } else if (routeName) {
          const sanitized = routeName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
          filename = `${sanitized}-motovault.gpx`;
        }

        // Save to cache directory
        const file = new File(Paths.cache, filename);
        if (file.exists) file.delete();
        file.create();
        file.write(gpxContent);

        // Open native share sheet
        await shareAsync(file.uri, {
          mimeType: 'application/gpx+xml',
          UTI: 'com.topografix.gpx',
          dialogTitle: 'Share GPX Route',
        });

        // Invalidate quota cache after successful export
        queryClient.invalidateQueries({ queryKey: queryKeys.routes.gpxQuota });

        if (process.env.EXPO_OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

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

  return { exportAndShare, isExporting };
}
