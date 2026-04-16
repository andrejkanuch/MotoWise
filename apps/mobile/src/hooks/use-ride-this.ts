import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import {
  buildAppleMapsUrl,
  buildGoogleMapsUrls,
  buildWazeUrls,
  type NavWaypoint,
} from '../utils/nav-handoff';

export type NavProvider = 'apple' | 'google' | 'waze' | 'gpx';

export interface RideThisProviderState {
  provider: NavProvider;
  available: boolean;
  /** Total segments the rider will step through (≥1 means row is actionable). */
  totalSegments: number;
  /** True when this provider will split the route into multiple URL handoffs. */
  chunked: boolean;
  /** Human-readable subtitle rendered inline under the provider label. */
  subtitle: string;
  /** Full URL chain for this provider (Apple/GPX = 1, Google chunks, Waze per-stop). */
  urls: string[];
}

interface UseRideThisArgs {
  surface: 'route' | 'trip';
  entityId: string;
  waypoints: NavWaypoint[];
  /** Route-detail routes go through the authed GPX hook; trips build GPX in-app. */
  onGpxExport: () => Promise<void> | void;
}

interface UseRideThisResult {
  visible: boolean;
  open: () => void;
  close: () => void;
  providers: Record<NavProvider, RideThisProviderState>;
  /**
   * Currently-executing chunked handoff, or null if the sheet is idle / finished.
   * Used by the sheet UI to render a "Segment N of M" progress strip.
   */
  activeSegment: {
    provider: NavProvider;
    index: number;
    total: number;
  } | null;
  triggerProvider: (provider: NavProvider) => Promise<void>;
  advanceSegment: () => Promise<void>;
}

const iosMajor = Platform.OS === 'ios' ? Number.parseInt(String(Platform.Version), 10) : 0;
const isAndroid = Platform.OS === 'android';

/**
 * Owns all state for the "Ride this" sheet: availability probes, provider URL
 * chains, multi-segment step-through, and analytics emission.
 *
 * Kept out of the component so the modal UI stays declarative and the state
 * machine is independently testable in the future.
 */
export function useRideThis({
  surface,
  entityId,
  waypoints,
  onGpxExport,
}: UseRideThisArgs): UseRideThisResult {
  const [visible, setVisible] = useState(false);
  const [wazeInstalled, setWazeInstalled] = useState<boolean | null>(null);
  const [activeSegment, setActiveSegment] = useState<UseRideThisResult['activeSegment']>(null);

  useEffect(() => {
    let cancelled = false;
    Linking.canOpenURL('waze://')
      .then((ok) => {
        if (!cancelled) setWazeInstalled(ok);
      })
      .catch(() => {
        if (!cancelled) setWazeInstalled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const providers = useMemo<UseRideThisResult['providers']>(() => {
    const appleUrl = buildAppleMapsUrl(waypoints, { iosMajorVersion: iosMajor || undefined });
    const google = buildGoogleMapsUrls(waypoints);
    const wazeChain = buildWazeUrls(waypoints);
    const canChainApple = Platform.OS === 'ios' && !!appleUrl && (iosMajor === 0 || iosMajor >= 16);

    const appleSubtitle = (() => {
      if (!appleUrl) return 'Needs at least two stops.';
      if (waypoints.length <= 2) return 'Door-to-door handoff.';
      if (!canChainApple) return 'Only start and end will transfer. Use GPX for mid-stops.';
      return `Full ${waypoints.length}-stop handoff (iOS 16+).`;
    })();

    const googleSubtitle = (() => {
      if (google.urls.length === 0) return 'Needs at least two stops.';
      if (google.chunked) {
        return `${waypoints.length} stops → ${google.urls.length} segments (we'll hand off).`;
      }
      return `${waypoints.length}-stop handoff.`;
    })();

    const wazeSubtitle = (() => {
      if (wazeChain.length === 0) return 'Needs at least two stops.';
      if (wazeInstalled === false) return 'Tap to install Waze.';
      if (wazeChain.length === 1) return 'One-stop handoff.';
      return `One stop at a time · ${wazeChain.length} segments.`;
    })();

    return {
      apple: {
        provider: 'apple',
        available: Platform.OS === 'ios' && appleUrl !== null,
        totalSegments: appleUrl ? 1 : 0,
        chunked: false,
        subtitle: appleSubtitle,
        urls: appleUrl ? [appleUrl] : [],
      },
      google: {
        provider: 'google',
        available: google.urls.length > 0,
        totalSegments: google.urls.length,
        chunked: google.chunked,
        subtitle: googleSubtitle,
        urls: google.urls,
      },
      waze: {
        provider: 'waze',
        // Android: no canOpenURL gating — the intent resolves if Waze is installed
        // and gracefully fails otherwise. iOS: gate on the real probe so a missing
        // Waze falls into the App-Store recovery path in triggerProvider.
        available: wazeChain.length > 0 && (isAndroid || wazeInstalled === true),
        totalSegments: wazeChain.length,
        chunked: wazeChain.length > 1,
        subtitle: wazeSubtitle,
        urls: wazeChain,
      },
      gpx: {
        provider: 'gpx',
        available: waypoints.length >= 2,
        totalSegments: waypoints.length >= 2 ? 1 : 0,
        chunked: false,
        subtitle: 'Calimoto · Rever · TomTom · Scenic',
        urls: [],
      },
    };
  }, [waypoints, wazeInstalled]);

  const emit = useCallback(
    (provider: NavProvider, segmentIndex: number, totalSegments: number) => {
      trackEvent(AnalyticsEvent.NAV_HANDOFF, {
        surface,
        provider,
        entity_id: entityId,
        waypoint_count: waypoints.length,
        chunked: totalSegments > 1,
        segment_index: segmentIndex + 1,
        segment_total: totalSegments,
      });

      // Legacy alias for PostHog funnel continuity — only on first segment
      // so chunked / multi-leg handoffs don't inflate the funnel.
      if (
        segmentIndex === 0 &&
        surface === 'trip' &&
        (provider === 'apple' || provider === 'google' || provider === 'waze')
      ) {
        trackEvent(AnalyticsEvent.TRIP_OPENED_IN_MAPS, {
          trip_id: entityId,
          waypoint_count: waypoints.length,
          provider,
        });
      }
    },
    [surface, entityId, waypoints.length],
  );

  const openUrlWithHaptic = useCallback(async (url: string) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await Linking.openURL(url);
  }, []);

  const open = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setActiveSegment(null);
  }, []);

  const triggerProvider = useCallback(
    async (provider: NavProvider) => {
      const state = providers[provider];
      if (!state.available) {
        // Waze on iOS without install → App Store fallback.
        if (provider === 'waze' && Platform.OS === 'ios') {
          await Linking.openURL(
            'https://apps.apple.com/app/waze-navigation-live-traffic/id323229106',
          );
        }
        return;
      }

      if (provider === 'gpx') {
        emit('gpx', 0, 1);
        await onGpxExport();
        close();
        return;
      }

      emit(provider, 0, state.totalSegments);
      await openUrlWithHaptic(state.urls[0]);

      if (state.totalSegments > 1) {
        setActiveSegment({ provider, index: 0, total: state.totalSegments });
      } else {
        close();
      }
    },
    [providers, emit, openUrlWithHaptic, onGpxExport, close],
  );

  const advanceSegment = useCallback(async () => {
    if (!activeSegment) return;
    const nextIndex = activeSegment.index + 1;
    const state = providers[activeSegment.provider];
    if (nextIndex >= state.urls.length) {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      close();
      return;
    }
    emit(activeSegment.provider, nextIndex, state.totalSegments);
    await openUrlWithHaptic(state.urls[nextIndex]);
    setActiveSegment({ ...activeSegment, index: nextIndex });
  }, [activeSegment, providers, emit, openUrlWithHaptic, close]);

  return {
    visible,
    open,
    close,
    providers,
    activeSegment,
    triggerProvider,
    advanceSegment,
  };
}
