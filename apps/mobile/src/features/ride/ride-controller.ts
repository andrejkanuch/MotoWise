// Shared ride command surface — the single, UI-free path for starting and ending
// a ride. Both the phone screens (start-ride, ride-hud) and the CarPlay
// coordinator call these so a ride started or ended from the head unit goes
// through exactly the same orchestration (permissions, ride id, MMKV, GPS/
// background-location listener, server sync, analytics) as one started on the
// phone. Navigation and other UI concerns stay with the callers — these return
// data, they don't route.

import { EndRideDocument, StartRideDocument } from '@motovault/graphql';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import type { Href } from 'expo-router';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { encodePolyline } from '../../utils/ride-heatmap';
import { distanceMeters, startGPSListener, stopGPSListener } from '../../utils/ride-location';
import { checkAndRequestPermissions } from '../../utils/ride-permissions';
import {
  flushBufferToMMKV,
  getPointBuffer,
  getWaypointChunks,
  removeWaypointBuffer,
  rideMMKV,
} from '../../utils/ride-storage';
import { enqueueOrExecute } from '../../utils/ride-sync-queue';

export type RideSource = 'phone' | 'carplay';

export type RideStartResult =
  | { ok: true; rideId: string }
  | { ok: false; reason: 'denied' | 'gps_failed' };

export interface StartRideOptions {
  motorcycleId: string | null;
  source: RideSource;
  /** Optional, analytics only. */
  motorcycleMake?: string | null;
}

/**
 * Start a fresh ride: request permissions, mint the ride id, persist it, flip the
 * store to recording, enqueue the server start, and begin the background-capable
 * GPS listener. Returns the new ride id, or `{ ok: false, reason: 'denied' }` when
 * location permission is refused (the caller surfaces the UI).
 */
export async function startRideSession({
  motorcycleId,
  source,
  motorcycleMake = null,
}: StartRideOptions): Promise<RideStartResult> {
  const level = await checkAndRequestPermissions();
  if (level === 'denied') return { ok: false, reason: 'denied' };

  const rideId = Crypto.randomUUID();
  const startedAt = new Date().toISOString();

  rideMMKV.setCurrentId(rideId);
  rideMMKV.setStartedAt(Date.now());
  if (motorcycleId) rideMMKV.setMotorcycleId(motorcycleId);

  const store = useRideStore.getState();
  store.setPermissionLevel(level);
  store.startRide();

  try {
    await startGPSListener();
  } catch (err) {
    // GPS failed to start — roll back so we never strand a half-started ride
    // (persisted id + recording store) that the next launch reads as unfinished.
    captureException(err, { source: 'ride-controller.startRideSession' });
    rideMMKV.setCurrentId('');
    store.endRide();
    return { ok: false, reason: 'gps_failed' };
  }

  // Haptic confirms the start on the phone; on CarPlay the phone may be pocketed.
  if (source === 'phone' && process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  // Tell the server only after GPS is confirmed running (rollback above otherwise).
  enqueueOrExecute('startRide', {
    mutationDocument: StartRideDocument,
    variables: { input: { rideId, motorcycleId, startedAt } },
  });

  trackEvent(AnalyticsEvent.RIDE_STARTED, {
    ride_id: rideId,
    has_motorcycle: !!motorcycleId,
    motorcycle_id: motorcycleId ?? null,
    motorcycle_make: motorcycleMake,
    hud_layout: rideMMKV.getHudLayout() ?? 'A',
    is_resumed: false,
    source,
  });

  return { ok: true, rideId };
}

export interface RideEndSummary {
  rideId: string;
  distanceM: number;
  durationS: number;
  maxSpeedMps: number;
  avgSpeedMps: number;
  elevationGain: number;
  elevationLoss: number;
  startedAt: number | undefined;
  motorcycleId: string | null;
}

/** Elapsed riding seconds derived from persisted timestamps (no UI timer needed). */
export function elapsedRideSeconds(now: number = Date.now()): number {
  const startedAt = rideMMKV.getStartedAt();
  if (!startedAt) return 0;
  return Math.max(0, Math.round((now - startedAt - rideMMKV.getTotalPausedMs()) / 1000));
}

/**
 * End the current ride: aggregate the recorded waypoints, stop the GPS listener,
 * flip the store to ended, fire analytics, and enqueue the server end. Returns a
 * summary for the caller to render/navigate with, or null when no ride is active.
 * Pure of navigation so it can run from CarPlay with no phone UI mounted.
 */
export function endRideSession(source: RideSource = 'phone'): RideEndSummary | null {
  const rideId = rideMMKV.getCurrentId();
  if (!rideId) return null;

  // Idempotent against a double-Stop (or a Stop racing the auto-end timer): this
  // function deliberately does NOT clear the persisted ride id (the summary owns
  // cleanup), so without this guard a second invocation would re-run the full end
  // path and enqueue a duplicate EndRide mutation + a second summary navigation.
  // Once the store is 'ended', bail.
  if (useRideStore.getState().status === 'ended') return null;

  flushBufferToMMKV(rideId);

  const chunks = getWaypointChunks(rideId);
  const bufferPoints = [...getPointBuffer()];
  const combined = [...chunks.flat(), ...bufferPoints];

  if (bufferPoints.length > 0) {
    enqueueOrExecute('uploadWaypoints', {
      variables: { input: { rideId, waypoints: bufferPoints } },
    });
  }
  // Drop the persisted buffer key now that the points are durably enqueued —
  // prevents crash-recovery from re-enqueuing them as duplicates after end.
  removeWaypointBuffer(rideId);

  let totalDistance = 0;
  let maxSpd = 0;
  let speedSum = 0;
  let speedCount = 0;
  let elevGain = 0;
  let elevLoss = 0;

  for (let i = 0; i < combined.length; i++) {
    const wp = combined[i];
    if (i > 0) {
      totalDistance += distanceMeters(
        { lat: combined[i - 1].latitude, lng: combined[i - 1].longitude },
        { lat: wp.latitude, lng: wp.longitude },
      );
      const prevAlt = combined[i - 1].altitude;
      const curAlt = wp.altitude;
      if (prevAlt != null && curAlt != null) {
        const diff = curAlt - prevAlt;
        if (diff > 0) elevGain += diff;
        else elevLoss += Math.abs(diff);
      }
    }
    const speed = wp.speedMps ?? 0;
    if (speed > maxSpd) maxSpd = speed;
    if (speed > 0) {
      speedSum += speed;
      speedCount++;
    }
  }

  const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
  const durationS = elapsedRideSeconds();
  const totalPausedMs = rideMMKV.getTotalPausedMs();
  const totalAutoPausedMs = rideMMKV.getTotalAutoPausedMs();
  // Capture identity before store.endRide() — the ride-summary screen owns MMKV
  // cleanup (on save/discard), and the returned summary must still carry these.
  const startedAt = rideMMKV.getStartedAt();
  const motorcycleId = rideMMKV.getMotorcycleId() ?? null;
  const store = useRideStore.getState();
  const maxLeanAngle = store.maxLeanAngle;
  const isNightMode = store.isNightMode;
  const isBatterySaver = store.isBatterySaver;
  const endedAt = new Date().toISOString();

  store.endRide();
  void stopGPSListener();

  trackEvent(AnalyticsEvent.RIDE_ENDED, {
    ride_id: rideId,
    motorcycle_id: motorcycleId,
    duration_s: durationS,
    distance_m: Math.round(totalDistance),
    pause_count: totalPausedMs > 0 ? 1 : 0,
    total_pause_duration_s: Math.round(totalPausedMs / 1000),
    night_mode_used: isNightMode,
    battery_saver_used: isBatterySaver,
    hud_layout_final: rideMMKV.getHudLayout() ?? 'A',
    max_speed_kmh: Math.round(maxSpd * 3.6),
    avg_speed_kmh: Math.round(avgSpeed * 3.6),
    waypoint_count: combined.length,
    source,
  });

  const polyline =
    combined.length >= 2
      ? encodePolyline(combined.map((wp) => [wp.latitude, wp.longitude] as [number, number]))
      : null;

  enqueueOrExecute('endRide', {
    mutationDocument: EndRideDocument,
    variables: {
      input: {
        rideId,
        endedAt,
        distanceM: Math.round(totalDistance),
        maxSpeedMps: maxSpd > 0 ? maxSpd : null,
        avgSpeedMps: avgSpeed > 0 ? avgSpeed : null,
        elevationGain: elevGain > 0 ? Math.round(elevGain) : null,
        elevationLoss: elevLoss > 0 ? Math.round(elevLoss) : null,
        routePolyline: polyline,
        pausedDurationS: Math.round(totalPausedMs / 1000),
        autoPausedDurationS: Math.round(totalAutoPausedMs / 1000),
        gpsQuality: combined.length > 0 ? 1 : 0,
        maxLeanAngle: maxLeanAngle > 0 ? maxLeanAngle : null,
      },
    },
  });

  // Both the phone HUD and a CarPlay Stop now route to the ride-summary screen,
  // which is the single owner of ride-data cleanup (it clears on save/discard).
  // We deliberately do NOT clear here — clearing would wipe the waypoint chunks the
  // summary reads to draw the route. (autoEndRide is the only truly headless end; it
  // stops GPS and drops the in-memory buffer but, like this path, leaves the
  // persisted ride id for the summary / crash-recovery to reconcile.)
  return {
    rideId,
    distanceM: Math.round(totalDistance),
    durationS,
    maxSpeedMps: maxSpd,
    avgSpeedMps: avgSpeed,
    elevationGain: Math.round(elevGain),
    elevationLoss: Math.round(elevLoss),
    startedAt,
    motorcycleId,
  };
}

/**
 * The ride-summary route for a finished ride. Shared by the phone HUD's End and the
 * CarPlay Stop so both surfaces land on the same summary (which reads these params
 * and owns clearing the ride data). Pure — builds the Href, never navigates.
 */
export function buildRideSummaryHref(summary: RideEndSummary): Href {
  return {
    pathname: '/(modals)/ride-summary',
    params: {
      rideId: summary.rideId,
      distanceM: String(summary.distanceM),
      durationS: String(summary.durationS),
      maxSpeedMps: String(summary.maxSpeedMps),
      avgSpeedMps: String(summary.avgSpeedMps),
      elevationGain: String(summary.elevationGain),
      elevationLoss: String(summary.elevationLoss),
      startedAt: summary.startedAt?.toString() ?? '',
      motorcycleId: summary.motorcycleId ?? '',
    },
  };
}
