import type BottomSheet from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { HudLayoutA } from '../../components/ride/hud-layout-a';
import { HudLayoutB } from '../../components/ride/hud-layout-b';
import { type HudLayout, HudLayoutSwitcher } from '../../components/ride/hud-layout-switcher';
import { GpsLostBanner } from '../../features/ride/gps-lost-banner';
import {
  buildRideSummaryHref,
  endRideSession,
  pauseRideSession,
  resumeRideSession,
} from '../../features/ride/ride-controller';
import {
  buildRideGuardSnapshot,
  cachedHasRealRide,
  isBelowRideFloors,
  RIDE_GUARD_ACTION,
  type RideGuardSnapshot,
  trackRideGuard,
} from '../../features/ride/ride-guard';
import { RideGuardSheet } from '../../features/ride/ride-guard-sheet';
import { RIDE_TEST_ID } from '../../features/ride/ride-test-ids';
import { useBatterySaverToggle } from '../../features/ride/use-battery-saver-toggle';
import { useRideElapsed } from '../../features/ride/use-ride-elapsed';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { bestEffortNativeCall, NativeSideEffect } from '../../lib/best-effort-native';
import { useRideStore } from '../../stores/ride.store';
import { triggerImpact } from '../../utils/haptics';
import { getPointBuffer, getWaypointChunks, rideMMKV } from '../../utils/ride-storage';
import { hasPendingSyncWork } from '../../utils/ride-sync-queue';

type SparklineMode = 'altitude' | 'speed';

/**
 * Keep-awake lock tag. Activation and deactivation must pass the SAME tag or the
 * lock is never released, so it lives in one constant.
 */
const KEEP_AWAKE_TAG = 'ride-hud';

/** Read persisted HUD layout preference from MMKV */
function getPersistedLayout(): HudLayout {
  return rideMMKV.getHudLayout() as HudLayout;
}

function persistLayout(layout: HudLayout) {
  rideMMKV.setHudLayout(layout);
}

const APP_STATE_ACTIVE = 'active';

/** Any location point reached the ride (in the live buffer or flushed to a chunk). */
function rideHasPoints(rideId: string | undefined): boolean {
  if (getPointBuffer().length > 0) return true;
  return rideId != null && getWaypointChunks(rideId).some((chunk) => chunk.length > 0);
}

export default function RideHudScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useRideStore((s) => s.status);
  const distance = useRideStore((s) => s.distance);
  const currentSpeed = useRideStore((s) => s.currentSpeed);
  const maxSpeed = useRideStore((s) => s.maxSpeed);
  const elevationGain = useRideStore((s) => s.elevationGain);
  const currentAltitude = useRideStore((s) => s.currentAltitude);
  const isNightMode = useRideStore((s) => s.isNightMode);
  const isBatterySaver = useRideStore((s) => s.isBatterySaver);
  const toggleNight = useRideStore((s) => s.toggleNightMode);
  const handleToggleBattery = useBatterySaverToggle();

  const [hudLayout, setHudLayout] = useState<HudLayout>(() => getPersistedLayout());
  // Engine-owned clock (persisted timestamps), the same one every surface shows.
  const elapsedSeconds = useRideElapsed();
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;
  const [sparklineMode, setSparklineMode] = useState<SparklineMode>('speed');
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [altitudeHistory, setAltitudeHistory] = useState<number[]>([]);
  const [liveWaypoints, setLiveWaypoints] = useState<Waypoint[]>([]);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [_syncPending, setSyncPending] = useState(false);

  // Minimum ride guard: the sheet, what it was opened with, and whether a fix ever arrived.
  const guardSheetRef = useRef<BottomSheet>(null);
  const [guardData, setGuardData] = useState<RideGuardSnapshot | null>(null);
  const hadFixRef = useRef(false);

  const isPaused = status === 'paused';
  const bgColor = isNightMode ? palette.nightBg : palette.neutral950;

  const currentSpeedRef = useRef(currentSpeed);
  currentSpeedRef.current = currentSpeed;

  // Layout switching
  const handleLayoutSwitch = useCallback(
    (layout: HudLayout) => {
      const prev = hudLayout;
      setHudLayout(layout);
      persistLayout(layout);
      trackEvent(AnalyticsEvent.RIDE_HUD_LAYOUT_SWITCHED, {
        ride_id: rideMMKV.getCurrentId() ?? null,
        from_layout: prev,
        to_layout: layout,
        duration_at_switch_s: elapsedRef.current,
      });
    },
    [hudLayout],
  );

  // Collect sparkline data + live waypoints every ~5 seconds — only while the HUD can
  // be seen. In the background nobody is looking, and the full waypoint re-read below
  // grows with ride length: on a long backgrounded ride it was re-rendering and
  // re-laying out the HUD every 5 s for nobody (implicated in a background ANR on
  // Android, MOTO-VAULT-REACT-NATIVE-3J; and the 3.20.0 CarPlay timer swap keeps JS
  // timers running in the background on iOS too). Recording itself is unaffected:
  // GPS points are written by the location task, not here.
  useEffect(() => {
    const sample = () => {
      if (isPaused) return;

      setSpeedHistory((prev) => {
        const next = [...prev, currentSpeedRef.current];
        return next.length > 300 ? next.slice(-300) : next;
      });

      const buffer = getPointBuffer();
      if (buffer.length > 0) {
        hadFixRef.current = true;
        const lastPoint = buffer[buffer.length - 1];
        if (lastPoint.altitude != null) {
          setAltitudeHistory((prev) => {
            const next = [...prev, lastPoint.altitude as number];
            return next.length > 300 ? next.slice(-300) : next;
          });
        }
        setGpsAccuracy(lastPoint.accuracy ?? 0);
      }

      const rideId = rideMMKV.getCurrentId();
      if (rideId) {
        const chunks = getWaypointChunks(rideId);
        setLiveWaypoints([...chunks.flat(), ...buffer]);
      }
    };
    const interval = setInterval(() => {
      if (AppState.currentState === APP_STATE_ACTIVE) sample();
    }, 5000);
    // Catch the route up as soon as the rider is back on the HUD.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === APP_STATE_ACTIVE) sample();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isPaused]);

  // Keep screen awake. Both calls are fire-and-forget native side effects, and
  // a ride HUD is exactly where Android tears the Activity down under us — long
  // sessions, screen off, low-end devices reclaiming memory. The unmount
  // deactivate then rejects with ERR_MISSING_ACTIVITY and used to escape as an
  // unhandled rejection. (Sentry MOTO-VAULT-REACT-NATIVE-19)
  useEffect(() => {
    bestEffortNativeCall(NativeSideEffect.KEEP_AWAKE_ACTIVATE, () =>
      activateKeepAwakeAsync(KEEP_AWAKE_TAG),
    );
    return () => {
      bestEffortNativeCall(NativeSideEffect.KEEP_AWAKE_DEACTIVATE, () =>
        deactivateKeepAwake(KEEP_AWAKE_TAG),
      );
    };
  }, []);

  // Pause and resume go through the controller, the same path as CarPlay's
  // (pause clock, reminders, analytics).
  const handlePause = useCallback(() => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Heavy);
    pauseRideSession('phone');
  }, []);

  const handleResume = useCallback(() => {
    triggerImpact(Haptics.ImpactFeedbackStyle.Heavy);
    resumeRideSession('phone');
  }, []);

  /** End the ride via the shared controller, then route to the summary. */
  const executeEndRide = useCallback(() => {
    const summary = endRideSession('phone');
    if (!summary) return;

    // Count dead-lettered ops too: a ride whose waypoints failed to deliver is the
    // case the rider most needs the "still syncing" state for, and those ops sit in
    // the dead-letter queue, not the main one.
    if (hasPendingSyncWork()) setSyncPending(true);

    router.replace(buildRideSummaryHref(summary));
  }, [router]);

  const handleEndRide = useCallback(() => {
    const elapsed = elapsedRef.current;
    const { distance: dist, maxSpeed: maxSpeedMps } = useRideStore.getState();

    if (isBelowRideFloors(elapsed, dist)) {
      const rideId = rideMMKV.getCurrentId();
      const snapshot = buildRideGuardSnapshot({
        elapsedS: elapsed,
        distanceM: dist,
        maxSpeedMps,
        gpsFix: hadFixRef.current || rideHasPoints(rideId),
        hasRealRide: cachedHasRealRide(queryClient),
      });
      setGuardData(snapshot);
      guardSheetRef.current?.expand();
      trackRideGuard(snapshot, RIDE_GUARD_ACTION.SHOWN, rideId ?? null);
      return;
    }

    executeEndRide();
  }, [executeEndRide, queryClient]);

  const handleGuardKeepRiding = useCallback(() => {
    if (guardData) {
      trackRideGuard(guardData, RIDE_GUARD_ACTION.KEEP, rideMMKV.getCurrentId() ?? null);
    }
    guardSheetRef.current?.close();
    setGuardData(null);
  }, [guardData]);

  const handleGuardEndAnyway = useCallback(() => {
    if (guardData) {
      trackRideGuard(guardData, RIDE_GUARD_ACTION.END, rideMMKV.getCurrentId() ?? null);
    }
    guardSheetRef.current?.close();
    setGuardData(null);
    executeEndRide();
  }, [executeEndRide, guardData]);

  const handleToggleNight = useCallback(() => {
    triggerImpact();
    toggleNight();
  }, [toggleNight]);

  const handleToggleSparkline = useCallback(() => {
    triggerImpact();
    setSparklineMode((m) => (m === 'speed' ? 'altitude' : 'speed'));
  }, []);

  const avgSpeedDisplay = elapsedSeconds > 0 && distance > 0 ? distance / elapsedSeconds : 0;

  return (
    <View testID={RIDE_TEST_ID.HUD_ROOT} style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Layout switcher — floating overlay */}
      <View style={{ position: 'absolute', top: 58, left: 20, zIndex: 20 }}>
        <HudLayoutSwitcher
          activeLayout={hudLayout}
          onSwitch={handleLayoutSwitch}
          isNightMode={isNightMode}
        />
      </View>

      {/* Active layout */}
      {hudLayout === 'A' ? (
        <HudLayoutA
          isPaused={isPaused}
          isNightMode={isNightMode}
          isBatterySaver={isBatterySaver}
          elapsedSeconds={elapsedSeconds}
          currentSpeed={currentSpeed}
          maxSpeed={maxSpeed}
          distance={distance}
          elevationGain={elevationGain}
          currentAltitude={currentAltitude}
          avgSpeedDisplay={avgSpeedDisplay}
          speedHistory={speedHistory}
          altitudeHistory={altitudeHistory}
          sparklineMode={sparklineMode}
          liveWaypoints={liveWaypoints}
          gpsAccuracy={gpsAccuracy}
          onToggleNight={handleToggleNight}
          onToggleBattery={handleToggleBattery}
          onToggleSparkline={handleToggleSparkline}
          onPause={handlePause}
          onResume={handleResume}
          onEndRide={handleEndRide}
        />
      ) : (
        <HudLayoutB
          isPaused={isPaused}
          isNightMode={isNightMode}
          elapsedSeconds={elapsedSeconds}
          currentSpeed={currentSpeed}
          distance={distance}
          avgSpeed={avgSpeedDisplay}
          maxSpeed={maxSpeed}
          elevationGain={elevationGain}
          gpsAccuracy={gpsAccuracy}
          liveWaypoints={liveWaypoints}
          onPause={handlePause}
          onResume={handleResume}
          onEndRide={handleEndRide}
          onToggleNight={handleToggleNight}
        />
      )}

      <GpsLostBanner onEndRide={handleEndRide} />

      <RideGuardSheet
        sheetRef={guardSheetRef}
        guard={guardData}
        onKeepRiding={handleGuardKeepRiding}
        onEndAnyway={handleGuardEndAnyway}
      />
    </View>
  );
}
