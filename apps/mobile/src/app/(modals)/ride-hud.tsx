import { palette } from '@motovault/design-system';
import { EndRideDocument } from '@motovault/graphql';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { BatteryLow, Moon, Sun } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { HudMap } from '../../components/ride/hud-map';
import { HudSpeed } from '../../components/ride/hud-speed';
import { useRideStore } from '../../stores/ride.store';
import { distanceMeters, stopGPSListener, toggleBatterySaver } from '../../utils/ride-location';
import {
  flushBufferToMMKV,
  getPointBuffer,
  getWaypointChunks,
  rideMMKV,
} from '../../utils/ride-storage';
import { enqueue } from '../../utils/ride-sync-queue';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import {
  formatDistance,
  formatElapsed,
  formatSpeed,
} from '../../utils/ride-formatters';

export default function RideHudScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
  const status = useRideStore((s) => s.status);
  const distance = useRideStore((s) => s.distance);
  const isNightMode = useRideStore((s) => s.isNightMode);
  const isBatterySaver = useRideStore((s) => s.isBatterySaver);
  const toggleNight = useRideStore((s) => s.toggleNightMode);
  const toggleBattery = useRideStore((s) => s.toggleBatterySaver);
  const pauseRide = useRideStore((s) => s.pauseRide);
  const resumeRide = useRideStore((s) => s.resumeRide);
  const endRide = useRideStore((s) => s.endRide);
  const updateElapsedTime = useRideStore((s) => s.updateElapsedTime);
  const _updateSpeed = useRideStore((s) => s.updateSpeed);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showAvgStats, setShowAvgStats] = useState(false);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedRef = useRef(0);

  const isPaused = status === 'paused';
  const bgColor = isNightMode ? palette.nightBg : palette.neutral950;
  const textColor = isNightMode ? palette.nightText : palette.white;

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
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    pauseRide();
    rideMMKV.setTotalPausedMs(totalPausedRef.current);
  }, [pauseRide]);

  const handleResume = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    resumeRide();
  }, [resumeRide]);

  const handleEndRide = useCallback(() => {
    const rideId = rideMMKV.getCurrentId();
    if (!rideId) return;

    // Flush remaining waypoints
    flushBufferToMMKV(rideId);

    // Gather all waypoints for stats
    const chunks = getWaypointChunks(rideId);
    const allWaypoints = chunks.flat();
    const bufferPoints = [...getPointBuffer()];
    const combined = [...allWaypoints, ...bufferPoints];

    // Calculate stats
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

    // Update store
    endRide();
    stopGPSListener();

    // Enqueue mutation
    enqueue('endRide', {
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
          pausedDurationS: Math.round(totalPausedRef.current / 1000),
          autoPausedDurationS: Math.round(rideMMKV.getTotalAutoPausedMs() / 1000),
          gpsQuality: combined.length > 0 ? 1 : 0,
        },
      },
    });

    // Navigate to summary
    const summaryRoute = {
      pathname: '/(modals)/ride-summary' as const,
      params: {
        rideId,
        distanceM: String(Math.round(totalDistance)),
        durationS: String(elapsedSeconds),
        maxSpeedMps: String(maxSpeed),
        avgSpeedMps: String(avgSpeed),
        elevationGain: String(Math.round(elevGain)),
        startedAt: rideMMKV.getStartedAt()?.toString() ?? '',
      },
    };
    // biome-ignore lint/suspicious/noExplicitAny: expo-router does not export typed route params
    router.replace(summaryRoute as any);
  }, [endRide, router, elapsedSeconds]);

  const handleToggleNight = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleNight();
  }, [toggleNight]);

  const handleToggleBattery = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const newState = !isBatterySaver;
    toggleBattery();
    toggleBatterySaver(newState);
  }, [toggleBattery, isBatterySaver]);

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

  // Avg speed for stats — guard against division by zero
  const avgSpeedDisplay =
    elapsedSeconds > 0 && distance > 0 ? distance / elapsedSeconds : 0;

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
        {/* Status badge — pulsing when paused */}
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
            fontSize: 18,
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
            <BatteryLow
              size={22}
              color={isBatterySaver ? palette.warning500 : palette.iconMuted}
            />
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

      {/* Map zone */}
      <Animated.View entering={FadeInUp.delay(100).duration(300)} style={{ flex: 0.35 }}>
        <HudMap waypoints={[]} gpsAccuracy={0} />
      </Animated.View>

      {/* Speed hero */}
      <View style={{ flex: 0.3, alignItems: 'center', justifyContent: 'center' }}>
        <HudSpeed />
      </View>

      {/* Stats row */}
      <Pressable
        onPress={() => setShowAvgStats((v) => !v)}
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 16,
          paddingVertical: 12,
          paddingHorizontal: 20,
        }}
      >
        {!showAvgStats ? (
          <>
            <View
              style={{
                backgroundColor: palette.surfaceHover,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 20,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: isNightMode ? palette.nightText : palette.neutral500,
                  letterSpacing: 0.5,
                }}
              >
                DISTANCE
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                  color: textColor,
                  marginTop: 2,
                }}
              >
                {formatDistance(distance, system)}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: palette.surfaceHover,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 20,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: isNightMode ? palette.nightText : palette.neutral500,
                  letterSpacing: 0.5,
                }}
              >
                DURATION
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  fontVariant: ['tabular-nums'],
                  color: textColor,
                  marginTop: 2,
                }}
              >
                {formatElapsed(elapsedSeconds)}
              </Text>
            </View>
          </>
        ) : (
          <View
            style={{
              backgroundColor: palette.surfaceHover,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 20,
              paddingVertical: 10,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: isNightMode ? palette.nightText : palette.neutral500,
                letterSpacing: 0.5,
              }}
            >
              AVG SPEED
            </Text>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                color: textColor,
                marginTop: 2,
              }}
            >
              {formatSpeed(avgSpeedDisplay, system)}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Bottom controls */}
      <View style={{ paddingBottom: insets.bottom + 16 }}>
        <HudControls
          onPause={handlePause}
          onResume={handleResume}
          onEndRide={handleEndRide}
          isPaused={isPaused}
          isNightMode={isNightMode}
        />
      </View>
    </View>
  );
}
