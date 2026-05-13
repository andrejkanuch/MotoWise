import { palette } from '@motovault/design-system';
import { EndRideDocument } from '@motovault/graphql';
import type { Waypoint } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { BatteryLow, CloudUpload, Moon, Sun } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HudControls } from '../../components/ride/hud-controls';
import { HudLeanGauge } from '../../components/ride/hud-lean-gauge';
import { HudMap } from '../../components/ride/hud-map';
import { HudOfflineBanner } from '../../components/ride/hud-offline-banner';
import { HudSparkline } from '../../components/ride/hud-sparkline';
import { HudSpeed } from '../../components/ride/hud-speed';
import { useLeanAngle } from '../../hooks/use-lean-angle';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { useRideStore } from '../../stores/ride.store';
import {
  formatDistance,
  formatElapsed,
  formatElevation,
  formatSpeed,
} from '../../utils/ride-formatters';
import { encodePolyline } from '../../utils/ride-heatmap';
import { distanceMeters, stopGPSListener, toggleBatterySaver } from '../../utils/ride-location';
import {
  flushBufferToMMKV,
  getPointBuffer,
  getWaypointChunks,
  rideMMKV,
} from '../../utils/ride-storage';
import { enqueueOrExecute, getQueueLength } from '../../utils/ride-sync-queue';

type SparklineMode = 'altitude' | 'speed';

function haptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(style);
}

export default function RideHudScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
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
  const endRide = useRideStore((s) => s.endRide);
  const updateElapsedTime = useRideStore((s) => s.updateElapsedTime);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const elapsedRef = useRef(0);
  const [sparklineMode, setSparklineMode] = useState<SparklineMode>('speed');
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);
  const [altitudeHistory, setAltitudeHistory] = useState<number[]>([]);
  const [liveWaypoints, setLiveWaypoints] = useState<Waypoint[]>([]);
  const [gpsAccuracy, setGpsAccuracy] = useState(0);
  const [syncPending, setSyncPending] = useState(false);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedRef = useRef(0);

  const isPaused = status === 'paused';
  const bgColor = isNightMode ? palette.nightBg : palette.neutral950;
  const textColor = isNightMode ? palette.nightText : palette.white;
  const labelColor = isNightMode ? palette.nightText : palette.neutral500;

  // Lean angle sensor
  const { smoothLean, peakLeft, peakRight } = useLeanAngle();

  // Track current speed via ref for sparkline intervals (avoids re-render dep)
  const currentSpeedRef = useRef(currentSpeed);
  currentSpeedRef.current = currentSpeed;

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

      // Update live route polyline from chunks + buffer
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

  // Elapsed timer
  useEffect(() => {
    const startedAt = rideMMKV.getStartedAt();
    if (!startedAt) return;

    const interval = setInterval(() => {
      if (isPaused) return;
      const now = Date.now();
      const raw = Math.floor((now - startedAt) / 1000);
      const paused = Math.floor(totalPausedRef.current / 1000);
      const elapsed = Math.max(0, raw - paused);
      elapsedRef.current = elapsed;
      setElapsedSeconds(elapsed);
      updateElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, updateElapsedTime]);

  // Track pause duration
  useEffect(() => {
    if (isPaused) {
      pausedAtRef.current = Date.now();
    } else if (pausedAtRef.current) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
  }, [isPaused]);

  const handlePause = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    pauseRide();
    rideMMKV.setTotalPausedMs(totalPausedRef.current);
  }, [pauseRide]);

  const handleResume = useCallback(() => {
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    resumeRide();
  }, [resumeRide]);

  const handleEndRide = useCallback(() => {
    const rideId = rideMMKV.getCurrentId();
    if (!rideId) return;

    flushBufferToMMKV(rideId);

    const chunks = getWaypointChunks(rideId);
    const allWaypoints = chunks.flat();
    const bufferPoints = [...getPointBuffer()];
    const combined = [...allWaypoints, ...bufferPoints];

    // Upload any remaining waypoints that didn't fill a full chunk
    if (bufferPoints.length > 0) {
      enqueueOrExecute('uploadWaypoints', {
        variables: { input: { rideId, waypoints: bufferPoints } },
      });
    }

    let totalDistance = 0;
    let maxSpeed = 0;
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
      if (speed > maxSpeed) maxSpeed = speed;
      if (speed > 0) {
        speedSum += speed;
        speedCount++;
      }
    }

    const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
    const endedAt = new Date().toISOString();

    endRide();
    stopGPSListener();

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
          maxSpeedMps: maxSpeed > 0 ? maxSpeed : null,
          avgSpeedMps: avgSpeed > 0 ? avgSpeed : null,
          elevationGain: elevGain > 0 ? Math.round(elevGain) : null,
          elevationLoss: elevLoss > 0 ? Math.round(elevLoss) : null,
          routePolyline: polyline,
          pausedDurationS: Math.round(totalPausedRef.current / 1000),
          autoPausedDurationS: Math.round(rideMMKV.getTotalAutoPausedMs() / 1000),
          gpsQuality: combined.length > 0 ? 1 : 0,
        },
      },
    });

    const pending = getQueueLength();
    if (pending > 0) {
      setSyncPending(true);
    }

    const summaryRoute = {
      pathname: '/(modals)/ride-summary' as const,
      params: {
        rideId,
        distanceM: String(Math.round(totalDistance)),
        durationS: String(elapsedRef.current),
        maxSpeedMps: String(maxSpeed),
        avgSpeedMps: String(avgSpeed),
        elevationGain: String(Math.round(elevGain)),
        elevationLoss: String(Math.round(elevLoss)),
        startedAt: rideMMKV.getStartedAt()?.toString() ?? '',
        motorcycleId: rideMMKV.getMotorcycleId() ?? '',
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: expo-router does not export typed route params
    router.replace(summaryRoute as any);
  }, [endRide, router]);

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

  // Status badge
  const statusLabel = isPaused ? 'PAUSED' : 'RECORDING';
  const statusColor = isPaused ? palette.warning500 : palette.success500;
  const statusBg = isPaused ? palette.warningBgDark : palette.successBgDark;

  // Paused pulse animation
  const pausePulse = useSharedValue(0);
  useEffect(() => {
    if (isPaused) {
      pausePulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true);
    } else {
      pausePulse.value = withTiming(0, { duration: 300 });
    }
  }, [isPaused, pausePulse]);

  const pauseOverlayStyle = useAnimatedStyle(() => ({
    opacity: pausePulse.value * 0.06,
  }));

  const pauseBadgePulseStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + pausePulse.value * 0.4,
    transform: [{ scale: 1 + pausePulse.value * 0.05 }],
  }));

  // Computed stats
  const avgSpeedDisplay = elapsedSeconds > 0 && distance > 0 ? distance / elapsedSeconds : 0;

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* Top bar */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        {/* Status badge */}
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: statusBg,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 12,
              borderCurve: 'continuous',
            },
            isPaused ? pauseBadgePulseStyle : undefined,
          ]}
          accessibilityRole="text"
          accessibilityLabel={isPaused ? 'Ride paused' : 'Recording ride'}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: statusColor,
            }}
          />
          <Text style={{ fontSize: 13, fontWeight: '800', color: statusColor, letterSpacing: 1 }}>
            {statusLabel}
          </Text>
        </Animated.View>

        {/* Timer */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            color: textColor,
          }}
          accessibilityRole="text"
          accessibilityLabel={`Elapsed time: ${formatElapsed(elapsedSeconds)}`}
        >
          {formatElapsed(elapsedSeconds)}
        </Text>

        {/* Night / Battery toggle — 52pt for glove operation */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={handleToggleBattery}
            accessibilityRole="switch"
            accessibilityLabel="Battery saver"
            accessibilityState={{ checked: isBatterySaver }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderCurve: 'continuous',
              backgroundColor: isBatterySaver ? palette.warningBgDark : palette.controlBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BatteryLow size={22} color={isBatterySaver ? palette.warning500 : palette.iconMuted} />
          </Pressable>
          <Pressable
            onPress={handleToggleNight}
            accessibilityRole="switch"
            accessibilityLabel="Night mode"
            accessibilityState={{ checked: isNightMode }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderCurve: 'continuous',
              backgroundColor: isNightMode ? palette.nightGlow : palette.controlBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isNightMode ? (
              <Sun size={22} color={palette.nightText} />
            ) : (
              <Moon size={22} color={palette.iconMuted} />
            )}
          </Pressable>
        </View>
      </Animated.View>

      {/* Paused overlay — pulsing amber tint */}
      {isPaused && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: palette.warning500,
              zIndex: 5,
              pointerEvents: 'none',
            },
            pauseOverlayStyle,
          ]}
        />
      )}

      {/* Offline banner */}
      <HudOfflineBanner />

      {/* Map zone — takes all remaining space */}
      <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ flex: 1 }}>
        <HudMap waypoints={liveWaypoints} gpsAccuracy={gpsAccuracy} />
      </Animated.View>

      {/* Speed hero — fixed height, no absolute glow bleed */}
      <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
        <HudSpeed />
      </View>

      {/* Lean angle gauge — compact row */}
      <View style={{ paddingVertical: 4 }}>
        <HudLeanGauge
          smoothLean={smoothLean}
          peakLeft={peakLeft}
          peakRight={peakRight}
          isNightMode={isNightMode}
        />
      </View>

      {/* Live sparkline strip */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 6 }}>
        <HudSparkline
          data={sparklineMode === 'speed' ? speedHistory : altitudeHistory}
          mode={sparklineMode}
          isNightMode={isNightMode}
          onToggleMode={handleToggleSparkline}
        />
      </View>

      {/* Stats strip — 6 stats in two rows */}
      <View style={{ marginHorizontal: 20, gap: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: palette.surfaceHover,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <StatCell
            label={t('rideHud.dist')}
            value={formatDistance(distance, system)}
            textColor={textColor}
            labelColor={labelColor}
          />
          <StatDivider isNightMode={isNightMode} />
          <StatCell
            label={t('rideHud.time')}
            value={formatElapsed(elapsedSeconds)}
            textColor={textColor}
            labelColor={labelColor}
          />
          <StatDivider isNightMode={isNightMode} />
          <StatCell
            label={t('rideHud.avg')}
            value={formatSpeed(avgSpeedDisplay, system)}
            textColor={textColor}
            labelColor={labelColor}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: palette.surfaceHover,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <StatCell
            label={t('rideHud.max')}
            value={formatSpeed(maxSpeed, system)}
            textColor={textColor}
            labelColor={labelColor}
          />
          <StatDivider isNightMode={isNightMode} />
          <StatCell
            label={t('rideHud.elev')}
            value={formatElevation(elevationGain, system)}
            textColor={textColor}
            labelColor={labelColor}
          />
          <StatDivider isNightMode={isNightMode} />
          <StatCell
            label={t('rideHud.alt')}
            value={formatElevation(currentAltitude, system)}
            textColor={textColor}
            labelColor={labelColor}
          />
        </View>
      </View>

      {/* Bottom controls — fixed at bottom */}
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}>
        <HudControls
          onPause={handlePause}
          onResume={handleResume}
          onEndRide={handleEndRide}
          isPaused={isPaused}
          isNightMode={isNightMode}
        />
      </View>

      {syncPending && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(250)}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 100,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 14,
            backgroundColor: palette.accentTint,
            borderRadius: 14,
            borderCurve: 'continuous',
          }}
        >
          <CloudUpload size={18} color={palette.accent500} />
          <Text style={{ fontSize: 14, color: palette.accent500, fontWeight: '600', flex: 1 }}>
            Ride saved locally. Will upload when back online.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

function StatCell({
  label,
  value,
  textColor,
  labelColor,
}: {
  label: string;
  value: string;
  textColor: string;
  labelColor: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 10 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: labelColor,
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          color: textColor,
          marginTop: 2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function StatDivider({ isNightMode }: { isNightMode: boolean }) {
  return (
    <View
      style={{
        width: 1,
        backgroundColor: isNightMode ? palette.nightGlow : palette.surfaceElevated,
      }}
    />
  );
}
