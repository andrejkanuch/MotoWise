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
import { GpsLostBanner } from '../../features/ride/gps-lost-banner';
import {
  buildRideSummaryHref,
  endRideSession,
  pauseRideSession,
  resumeRideSession,
} from '../../features/ride/ride-controller';
import { useBatterySaverToggle } from '../../features/ride/use-battery-saver-toggle';
import { useRideElapsed } from '../../features/ride/use-ride-elapsed';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { bestEffortNativeCall, NativeSideEffect } from '../../lib/best-effort-native';
import { trackRideGuard } from '../../lib/ride-analytics';
import { useRideStore } from '../../stores/ride.store';
import { editorialThemes } from '../../theme/editorial';
import { radius, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { isBelowMinRide, isNoGpsRide } from '../../utils/ride-constants';
import { getPointBuffer, getWaypointChunks, rideMMKV, rideStorage } from '../../utils/ride-storage';
import { hasPendingSyncWork } from '../../utils/ride-sync-queue';

// The HUD is a riding instrument: always dark (night mode swaps to amber-red),
// in both system schemes, so its sheet uses the dark tokens directly.
const HUD_THEME = editorialThemes.dark;

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
    const dist = useRideStore.getState().distance;

    // Minimum ride guard: check if ride is too short
    if (isBelowMinRide(elapsed, dist)) {
      const guard = { elapsed_s: elapsed, distance_m: Math.round(dist) };
      setGuardData(guard);
      guardSheetRef.current?.expand();
      trackRideGuard(guard, 'shown');
      return;
    }

    executeEndRide();
  }, [executeEndRide]);

  const handleGuardKeepRiding = useCallback(() => {
    if (guardData) trackRideGuard(guardData, 'keep');
    guardSheetRef.current?.close();
    setGuardData(null);
  }, [guardData]);

  const handleGuardEndAnyway = useCallback(() => {
    if (guardData) trackRideGuard(guardData, 'end');
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

  const [showGuardTip] = useState(() => !rideStorage.getString('rideGuardTipShown'));
  const isNoGpsGuard = guardData != null && isNoGpsRide(guardData.elapsed_s);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
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

      {/* Minimum Ride Guard Bottom Sheet */}
      <BottomSheet
        ref={guardSheetRef}
        snapPoints={guardSnapPoints}
        index={-1}
        enablePanDownToClose
        backgroundStyle={{
          backgroundColor: HUD_THEME.surface,
          borderRadius: 24,
          borderCurve: 'continuous',
        }}
        handleIndicatorStyle={{
          backgroundColor: HUD_THEME.line2,
        }}
        enableDynamicSizing={false}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32 }}>
          <Text
            style={{
              ...type.sectionTitle,
              color: HUD_THEME.ink,
              marginBottom: 8,
            }}
          >
            {isNoGpsGuard ? t('rideHud.noGpsTitle') : t('rideHud.endRideTitle')}
          </Text>
          <Text
            style={{
              ...type.subhead,
              color: HUD_THEME.ink2,
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
                backgroundColor: HUD_THEME.surface2,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ ...type.label, color: HUD_THEME.dueInk }}>{t('rideHud.gpsTip')}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={handleGuardKeepRiding}
              style={{
                flex: 1,
                backgroundColor: HUD_THEME.surface2,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...type.bodyStrong, color: HUD_THEME.ink }}>
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
                backgroundColor: HUD_THEME.danger,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ ...type.bodyStrong, color: HUD_THEME.onPlate }}>
                {t('rideHud.endAnyway')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
