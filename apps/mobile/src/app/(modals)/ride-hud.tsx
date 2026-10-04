import BottomSheet from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Pressable, Text, View } from 'react-native';
import { HudLayoutA } from '../../components/ride/hud-layout-a';
import { HudLayoutB } from '../../components/ride/hud-layout-b';
import { type HudLayout, HudLayoutSwitcher } from '../../components/ride/hud-layout-switcher';
import {
  buildRideSummaryHref,
  elapsedRideSeconds,
  endRideSession,
} from '../../features/ride/ride-controller';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { bestEffortNativeCall, NativeSideEffect } from '../../lib/best-effort-native';
import { useRideStore } from '../../stores/ride.store';
import { toggleBatterySaver } from '../../utils/ride-location';
import { getPointBuffer, getWaypointChunks, rideMMKV, rideStorage } from '../../utils/ride-storage';
import { hasPendingSyncWork } from '../../utils/ride-sync-queue';

type SparklineMode = 'altitude' | 'speed';

/**
 * Keep-awake lock tag. Activation and deactivation must pass the SAME tag or the
 * lock is never released, so it lives in one constant.
 */
const KEEP_AWAKE_TAG = 'ride-hud';

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style);
}

/** Read persisted HUD layout preference from MMKV */
function getPersistedLayout(): HudLayout {
  return rideMMKV.getHudLayout() as HudLayout;
}

function persistLayout(layout: HudLayout) {
  rideMMKV.setHudLayout(layout);
}

const APP_STATE_ACTIVE = 'active';

/** End-ride guard: under either floor, confirm before ending. */
const MIN_RIDE_ELAPSED_S = 30;
const MIN_RIDE_DISTANCE_M = 50;
/** Past this, a ride under the distance floor is not a mis-tap — the GPS recorded
 *  nothing (approximate location, no sky view, a killed background task). Saying
 *  "your ride was very short" to someone who rode for 40 minutes is wrong. */
const NO_GPS_MIN_ELAPSED_S = 120;

function isNoGpsRide(elapsedS: number): boolean {
  return elapsedS >= NO_GPS_MIN_ELAPSED_S;
}

function guardEvent(elapsedS: number) {
  return isNoGpsRide(elapsedS)
    ? AnalyticsEvent.RIDE_ZERO_DISTANCE_SHOWN
    : AnalyticsEvent.RIDE_TOO_SHORT_SHOWN;
}

export default function RideHudScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const status = useRideStore((s) => s.status);
  const distance = useRideStore((s) => s.distance);
  const currentSpeed = useRideStore((s) => s.currentSpeed);
  const maxSpeed = useRideStore((s) => s.maxSpeed);
  const elevationGain = useRideStore((s) => s.elevationGain);
  const currentAltitude = useRideStore((s) => s.currentAltitude);
  const isNightMode = useRideStore((s) => s.isNightMode);
  const isBatterySaver = useRideStore((s) => s.isBatterySaver);
  const toggleNight = useRideStore((s) => s.toggleNightMode);
  const toggleBattery = useRideStore((s) => s.toggleBatterySaver);
  const pauseRide = useRideStore((s) => s.pauseRide);
  const resumeRide = useRideStore((s) => s.resumeRide);
  const updateElapsedTime = useRideStore((s) => s.updateElapsedTime);

  const [hudLayout, setHudLayout] = useState<HudLayout>(() => getPersistedLayout());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef(0);
  const [sparklineMode, setSparklineMode] = useState<SparklineMode>('speed');
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [altitudeHistory, setAltitudeHistory] = useState<number[]>([]);
  const [liveWaypoints, setLiveWaypoints] = useState<Waypoint[]>([]);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [_syncPending, setSyncPending] = useState(false);

  // Bottom sheet for minimum ride guard
  const guardSheetRef = useRef<BottomSheet>(null);
  const guardSnapPoints = useMemo(() => ['35%'], []);
  const [guardData, setGuardData] = useState<{ elapsed_s: number; distance_m: number } | null>(
    null,
  );

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

  // Elapsed timer — engine-owned. elapsedRideSeconds() derives from persisted
  // timestamps and freezes during a pause (it subtracts banked + in-progress pause),
  // so the HUD no longer tracks pause time itself (that lived here and in CarPlay
  // divergently; the store's pauseRide/resumeRide now own the single pause clock).
  // Display-only (the HUD, the tab-bar ride banner): skipped in the background and
  // recomputed on return, which is exact because elapsed derives from timestamps.
  useEffect(() => {
    const tick = () => {
      const elapsed = elapsedRideSeconds();
      elapsedRef.current = elapsed;
      setElapsedSeconds(elapsed);
      updateElapsedTime(elapsed);
    };
    const interval = setInterval(() => {
      if (AppState.currentState === APP_STATE_ACTIVE) tick();
    }, 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === APP_STATE_ACTIVE) tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [updateElapsedTime]);

  const handlePause = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    pauseRide(); // store banks the pause clock (engine-owned, shared with CarPlay)
    trackEvent(AnalyticsEvent.RIDE_PAUSED, {
      ride_id: rideMMKV.getCurrentId() ?? null,
      duration_at_pause_s: elapsedRef.current,
      distance_at_pause_m: Math.round(distance),
    });
  }, [pauseRide, distance]);

  const handleResume = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    // Read the pause start before resumeRide() banks + clears it.
    const pausedAt = rideMMKV.getPausedAt();
    const pauseDuration = pausedAt > 0 ? Math.round((Date.now() - pausedAt) / 1000) : 0;
    resumeRide();
    trackEvent(AnalyticsEvent.RIDE_RESUMED, {
      ride_id: rideMMKV.getCurrentId() ?? null,
      pause_duration_s: pauseDuration,
    });
  }, [resumeRide]);

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
    const dist = useRideStore.getState().distance;

    // Minimum ride guard: check if ride is too short
    if (elapsed < MIN_RIDE_ELAPSED_S || dist < MIN_RIDE_DISTANCE_M) {
      setGuardData({ elapsed_s: elapsed, distance_m: Math.round(dist) });
      guardSheetRef.current?.expand();
      trackEvent(guardEvent(elapsed), {
        ride_id: rideMMKV.getCurrentId() ?? null,
        elapsed_s: elapsed,
        distance_m: Math.round(dist),
        action: 'shown',
      });
      return;
    }

    executeEndRide();
  }, [executeEndRide]);

  const handleGuardKeepRiding = useCallback(() => {
    if (guardData) {
      trackEvent(guardEvent(guardData.elapsed_s), {
        ride_id: rideMMKV.getCurrentId() ?? null,
        elapsed_s: guardData.elapsed_s,
        distance_m: guardData.distance_m,
        action: 'keep',
      });
    }
    guardSheetRef.current?.close();
    setGuardData(null);
  }, [guardData]);

  const handleGuardEndAnyway = useCallback(() => {
    if (guardData) {
      trackEvent(guardEvent(guardData.elapsed_s), {
        ride_id: rideMMKV.getCurrentId() ?? null,
        elapsed_s: guardData.elapsed_s,
        distance_m: guardData.distance_m,
        action: 'end',
      });
    }
    guardSheetRef.current?.close();
    setGuardData(null);
    executeEndRide();
  }, [executeEndRide, guardData]);

  const handleToggleNight = useCallback(() => {
    haptic();
    toggleNight();
  }, [toggleNight]);

  const handleToggleBattery = useCallback(() => {
    haptic();
    const newState = !isBatterySaver;
    toggleBattery();
    toggleBatterySaver(newState);
  }, [toggleBattery, isBatterySaver]);

  const handleToggleSparkline = useCallback(() => {
    haptic();
    setSparklineMode((m) => (m === 'speed' ? 'altitude' : 'speed'));
  }, []);

  const avgSpeedDisplay = elapsedSeconds > 0 && distance > 0 ? distance / elapsedSeconds : 0;

  const [showGuardTip] = useState(() => !rideStorage.getString('rideGuardTipShown'));
  const isNoGpsGuard = guardData != null && isNoGpsRide(guardData.elapsed_s);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Layout switcher — floating overlay */}
      <View
        style={{
          position: 'absolute',
          top: 58,
          left: 20,
          zIndex: 20,
        }}
      >
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

      {/* Minimum Ride Guard Bottom Sheet */}
      <BottomSheet
        ref={guardSheetRef}
        snapPoints={guardSnapPoints}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: palette.neutral900,
          borderRadius: 24,
          borderCurve: 'continuous',
        }}
        handleIndicatorStyle={{
          backgroundColor: palette.neutral600,
        }}
        enableDynamicSizing={false}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
          <Text
            style={{
              color: palette.neutral50,
              fontSize: 20,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            {isNoGpsGuard ? t('rideHud.noGpsTitle') : t('rideHud.endRideTitle')}
          </Text>
          <Text
            style={{
              color: palette.neutral400,
              fontSize: 15,
              lineHeight: 22,
              marginBottom: 16,
            }}
          >
            {isNoGpsGuard
              ? t('rideHud.noGpsBody', {
                  minutes: Math.round((guardData?.elapsed_s ?? 0) / 60),
                })
              : t('rideHud.shortRideWarning', {
                  seconds: guardData?.elapsed_s ?? 0,
                  meters: guardData?.distance_m ?? 0,
                })}
          </Text>

          {(showGuardTip || isNoGpsGuard) && (
            <View
              style={{
                backgroundColor: palette.neutral800,
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: palette.warning500, fontSize: 13, lineHeight: 18 }}>
                {t('rideHud.gpsTip')}
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleGuardKeepRiding}
              style={{
                flex: 1,
                backgroundColor: palette.neutral800,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: palette.neutral50, fontSize: 15, fontWeight: '600' }}>
                {t('rideHud.keepRiding')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                // Mark tip as shown after first interaction
                if (showGuardTip) {
                  rideStorage.set('rideGuardTipShown', 'true');
                }
                handleGuardEndAnyway();
              }}
              style={{
                flex: 1,
                backgroundColor: palette.danger500,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: palette.neutral50, fontSize: 15, fontWeight: '600' }}>
                {t('rideHud.endAnyway')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
