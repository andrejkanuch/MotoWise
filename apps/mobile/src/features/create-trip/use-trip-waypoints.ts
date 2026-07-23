import type MapboxGL from '@rnmapbox/maps';
import type { ScreenPointPayload } from '@rnmapbox/maps';
import * as Haptics from 'expo-haptics';
import { type RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { showActionSheet } from '../../utils/action-sheet';
import { getRouteSegments, type RouteLeg } from '../../utils/mapbox-directions';
import type { GeocodingResult } from '../../utils/mapbox-geocoding';
import { formatDayDate, tempId } from './format-trip-segments';
import type { LocalWaypoint, PeriodOfDayLocal } from './types';

interface UseTripWaypointsParams {
  cameraRef: RefObject<MapboxGL.Camera | null>;
  numDays: number;
  startDate: Date;
  isShowcase: boolean;
}

export function useTripWaypoints({
  cameraRef,
  numDays,
  startDate,
  isShowcase,
}: UseTripWaypointsParams) {
  const { t } = useTranslation();
  const [waypoints, setWaypoints] = useState<LocalWaypoint[]>([]);
  const [routeLegs, setRouteLegs] = useState<RouteLeg[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<GeoJSON.LineString | null>(null);

  // Edit stop modal state
  const [editingWaypoint, setEditingWaypoint] = useState<LocalWaypoint | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPeriod, setEditPeriod] = useState<PeriodOfDayLocal | null>(null);

  // Recalculate route segments when waypoints change (with cancellation)
  useEffect(() => {
    if (waypoints.length < 2) {
      setRouteLegs([]);
      setRouteGeometry(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
      const coords = sorted.map((wp) => ({ lat: wp.lat, lng: wp.lng }));
      const result = await getRouteSegments(coords, controller.signal);
      if (!controller.signal.aborted && result) {
        setRouteLegs(result.legs);
        setRouteGeometry(result.geometry);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [waypoints]);

  const openEditModal = useCallback((wp: LocalWaypoint) => {
    setEditName(wp.name);
    setEditType(wp.type);
    setEditNotes(wp.notes ?? '');
    setEditPeriod(wp.periodOfDay ?? null);
    setEditingWaypoint(wp);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditingWaypoint(null);
  }, []);

  const applyEdit = useCallback(() => {
    if (!editingWaypoint) return;
    setWaypoints((prev) =>
      prev.map((wp) =>
        wp.id === editingWaypoint.id
          ? {
              ...wp,
              name: editName.trim() || wp.name,
              type: editType,
              notes: editNotes.trim() || undefined,
              periodOfDay: editPeriod,
            }
          : wp,
      ),
    );
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingWaypoint(null);
  }, [editingWaypoint, editName, editType, editNotes, editPeriod]);

  // Route line GeoJSON — use actual road geometry when available, fallback to straight lines
  const routeGeoJSON = useMemo(() => {
    if (waypoints.length < 2) return null;
    if (routeGeometry) {
      return {
        type: 'Feature' as const,
        geometry: routeGeometry,
        properties: {},
      };
    }
    // Straight-line fallback while Directions API is loading
    const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: sorted.map((wp) => [wp.lng, wp.lat]),
      },
      properties: {},
    };
  }, [waypoints, routeGeometry]);

  // Camera bounds
  const bounds = useMemo(() => {
    if (waypoints.length === 0) return undefined;
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const wp of waypoints) {
      minLng = Math.min(minLng, wp.lng);
      maxLng = Math.max(maxLng, wp.lng);
      minLat = Math.min(minLat, wp.lat);
      maxLat = Math.max(maxLat, wp.lat);
    }
    return {
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [waypoints]);

  // Add a waypoint and fly the camera to it
  const addWaypoint = useCallback(
    (wp: Omit<LocalWaypoint, 'id'>) => {
      const newWp: LocalWaypoint = { ...wp, id: tempId() };
      setWaypoints((prev) => [...prev, newWp]);
      trackEvent(AnalyticsEvent.TRIP_WAYPOINT_ADDED, {
        waypoint_type: wp.type,
        waypoint_index: wp.sortOrder,
      });
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Fly camera to new waypoint
      cameraRef.current?.flyTo([wp.lng, wp.lat], 500);
    },
    [cameraRef],
  );

  // Default day for new waypoints: last day that has waypoints, or last day overall
  const defaultDayIndex = useMemo(() => {
    if (waypoints.length === 0) return 0;
    return Math.max(...waypoints.map((w) => w.dayIndex));
  }, [waypoints]);

  const handleGeocodingSelect = useCallback(
    (result: GeocodingResult) => {
      const type = waypoints.length === 0 ? 'start' : waypoints.length === 1 ? 'end' : 'scenic';
      addWaypoint({
        type,
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        notes: '',
        sortOrder: waypoints.length,
        dayIndex: defaultDayIndex,
      });
    },
    [addWaypoint, waypoints.length, defaultDayIndex],
  );

  // Map long-press handler — adds a scenic waypoint directly
  const handleLongPress = useCallback(
    (event: GeoJSON.Feature<GeoJSON.Point, ScreenPointPayload>) => {
      const [lng, lat] = event.geometry.coordinates;
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const type = waypoints.length === 0 ? 'start' : waypoints.length === 1 ? 'end' : 'scenic';
      addWaypoint({
        type,
        name: t('trips.defaultStopName', { number: waypoints.length + 1 }),
        lat,
        lng,
        notes: '',
        sortOrder: waypoints.length,
        dayIndex: defaultDayIndex,
      });
    },
    [addWaypoint, waypoints.length, defaultDayIndex, t],
  );

  // Reorder waypoints. Swap sortOrder by producing fresh objects for the two
  // affected waypoints — never mutate the objects held in state (that would
  // break React immutability and defeat reference-based memoization).
  const handleMoveUp = useCallback((index: number) => {
    setWaypoints((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      if (index <= 0 || index >= sorted.length) return prev;
      const current = sorted[index];
      const upper = sorted[index - 1];
      return sorted.map((wp) =>
        wp === current
          ? { ...wp, sortOrder: upper.sortOrder }
          : wp === upper
            ? { ...wp, sortOrder: current.sortOrder }
            : wp,
      );
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setWaypoints((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      if (index < 0 || index >= sorted.length - 1) return prev;
      const current = sorted[index];
      const lower = sorted[index + 1];
      return sorted.map((wp) =>
        wp === current
          ? { ...wp, sortOrder: lower.sortOrder }
          : wp === lower
            ? { ...wp, sortOrder: current.sortOrder }
            : wp,
      );
    });
  }, []);

  // Delete waypoint
  const handleDeleteWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => {
      const filtered = prev.filter((wp) => wp.id !== id);
      return filtered.map((wp, i) => ({ ...wp, sortOrder: i }));
    });
  }, []);

  const sortedWaypoints = useMemo(
    () => [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder),
    [waypoints],
  );

  const waypointsByDay = useMemo(() => {
    const groups: Record<number, LocalWaypoint[]> = {};
    for (let d = 0; d < numDays; d++) groups[d] = [];
    for (const wp of sortedWaypoints) {
      const d = Math.min(wp.dayIndex, numDays - 1);
      if (!groups[d]) groups[d] = [];
      groups[d].push(wp);
    }
    return groups;
  }, [sortedWaypoints, numDays]);

  // Move waypoint to a different day
  const handleMoveDay = useCallback(
    (waypointId: string) => {
      const dayOptions = Array.from({ length: numDays }, (_, i) =>
        isShowcase
          ? t('trips.dayHeaderShort', { day: i + 1 })
          : t('trips.dayHeader', { day: i + 1, date: formatDayDate(startDate, i) }),
      );

      showActionSheet(
        t('trips.moveToDayTitle'),
        [
          ...dayOptions.map((label, i) => ({
            label,
            onPress: () => {
              setWaypoints((prev) =>
                prev.map((wp) => (wp.id === waypointId ? { ...wp, dayIndex: i } : wp)),
              );
            },
          })),
          { label: t('common.cancel'), onPress: () => {}, style: 'cancel' as const },
        ],
        t('trips.selectDayForStop'),
      );
    },
    [numDays, startDate, isShowcase, t],
  );

  // Proximity for geocoding — center of existing waypoints or undefined
  const searchProximity = useMemo(() => {
    if (waypoints.length === 0) return undefined;
    const avgLat = waypoints.reduce((sum, wp) => sum + wp.lat, 0) / waypoints.length;
    const avgLng = waypoints.reduce((sum, wp) => sum + wp.lng, 0) / waypoints.length;
    return { lat: avgLat, lng: avgLng };
  }, [waypoints]);

  return {
    waypoints,
    setWaypoints,
    routeLegs,
    routeGeometry,
    routeGeoJSON,
    bounds,
    sortedWaypoints,
    waypointsByDay,
    searchProximity,
    handleGeocodingSelect,
    handleLongPress,
    handleMoveUp,
    handleMoveDown,
    handleDeleteWaypoint,
    handleMoveDay,
    openEditModal,
    // Edit modal fields
    editingWaypoint,
    editName,
    setEditName,
    editType,
    setEditType,
    editNotes,
    setEditNotes,
    editPeriod,
    setEditPeriod,
    closeEditModal,
    applyEdit,
  };
}
