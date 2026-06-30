import BottomSheet from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { HudLayoutA } from '../../components/ride/hud-layout-a';
import { HudLayoutB } from '../../components/ride/hud-layout-b';
import { type HudLayout, HudLayoutSwitcher } from '../../components/ride/hud-layout-switcher';
import {
  buildRideSummaryHref,
  elapsedRideSeconds,
  endRideSession,
} from '../../features/ride/ride-controller';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { toggleBatterySaver } from '../../utils/ride-location';
import { getPointBuffer, getWaypointChunks, rideMMKV, rideStorage } from '../../utils/ride-storage';
import { getQueueLength } from '../../utils/ride-sync-queue';

type SparklineMode = 'altitude' | 'speed';

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

  // Collect sparkline data + live waypoints every ~5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
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
    }, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Keep screen awake
  useEffect(() => {
    activateKeepAwakeAsync('ride-hud');
    return () => {
      deactivateKeepAwake('ride-hud');
    };
  }, []);

  // Elapsed timer — engine-owned. elapsedRideSeconds() derives from persisted
  // timestamps and freezes during a pause (it subtracts banked + in-progress pause),
  // so the HUD no longer tracks pause time itself (that lived here and in CarPlay
  // divergently; the store's pauseRide/resumeRide now own the single pause clock).
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = elapsedRideSeconds();
      elapsedRef.current = elapsed;
      setElapsedSeconds(elapsed);
      updateElapsedTime(elapsed);
    }, 1000);
    return () => clearInterval(interval);
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

    const pending = getQueueLength();
    if (pending > 0) setSyncPending(true);

    router.replace(buildRideSummaryHref(summary));
  }, [router]);

  const handleEndRide = useCallback(() => {
    const elapsed = elapsedRef.current;
    const dist = useRideStore.getState().distance;

    // Minimum ride guard: check if ride is too short
    if (elapsed < 30 || dist < 50) {
      setGuardData({ elapsed_s: elapsed, distance_m: Math.round(dist) });
      guardSheetRef.current?.expand();
      trackEvent(AnalyticsEvent.RIDE_TOO_SHORT_SHOWN, {
        ride_id: rideMMKV.getCurrentId() ?? null,
        elapsed_s: elapsed,
        distance_m: Math.round(dist),
        action: 'keep',
      });
      return;
    }

    executeEndRide();
  }, [executeEndRide]);

  const handleGuardKeepRiding = useCallback(() => {
    guardSheetRef.current?.close();
    setGuardData(null);
  }, []);

  const handleGuardEndAnyway = useCallback(() => {
    if (guardData) {
      trackEvent(AnalyticsEvent.RIDE_TOO_SHORT_SHOWN, {
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
            {t('rideHud.endRideTitle')}
          </Text>
          <Text
            style={{
              color: palette.neutral400,
              fontSize: 15,
              lineHeight: 22,
              marginBottom: 16,
            }}
          >
            {t('rideHud.shortRideWarning', {
              seconds: guardData?.elapsed_s ?? 0,
              meters: guardData?.distance_m ?? 0,
            })}
          </Text>

          {showGuardTip && (
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
