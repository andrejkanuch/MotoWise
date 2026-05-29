import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import { BatteryLow, Moon, Sun } from 'lucide-react-native';
import { useEffect } from 'react';
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
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import {
  formatDistance,
  formatElapsed,
  formatElevation,
  formatSpeed,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';
import { HudControls } from './hud-controls';
import { HudMap } from './hud-map';
import { HudSparkline } from './hud-sparkline';

export interface HudLayoutProps {
  // Status
  isPaused: boolean;
  isNightMode: boolean;
  isBatterySaver: boolean;
  elapsedSeconds: number;

  // Live data
  currentSpeed: number; // m/s
  maxSpeed: number; // m/s
  distance: number; // meters
  elevationGain: number; // meters
  currentAltitude: number; // meters
  avgSpeedDisplay: number; // m/s

  // Sparkline data
  speedHistory: number[];
  altitudeHistory: number[];
  sparklineMode: 'speed' | 'altitude';

  // Live map
  liveWaypoints: Waypoint[];
  gpsAccuracy: number;

  // Callbacks
  onToggleNight: () => void;
  onToggleBattery: () => void;
  onToggleSparkline: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndRide: () => void;
}

export function HudLayoutA({
  isPaused,
  isNightMode,
  isBatterySaver,
  elapsedSeconds,
  currentSpeed,
  maxSpeed,
  distance,
  elevationGain,
  currentAltitude,
  avgSpeedDisplay,
  speedHistory,
  altitudeHistory,
  sparklineMode,
  liveWaypoints,
  gpsAccuracy,
  onToggleNight,
  onToggleBattery,
  onToggleSparkline,
  onPause,
  onResume,
  onEndRide,
}: HudLayoutProps) {
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();

  const bgColor = isNightMode ? palette.nightBg : palette.neutral950;
  const textColor = isNightMode ? palette.nightText : palette.white;
  const labelColor = isNightMode ? palette.nightText : palette.neutral500;
  const mutedColor = isNightMode ? palette.nightText : palette.neutral400;

  // Status badge colors
  const statusLabel = isPaused ? 'PAUSED' : 'RECORDING';
  const statusColor = isPaused ? palette.warning500 : palette.success500;
  const statusBg = isPaused ? palette.warningBgDark : palette.successBgDark;

  // ── Paused pulse animation ──
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

  // ── Formatted values ──
  const displaySpeed = formatSpeedValue(currentSpeed, system);
  const displayMaxSpeed = formatSpeedValue(maxSpeed, system);
  const unitLabel = speedUnitLabel(system);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      {/* ── Top bar ── */}
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
            onPress={onToggleBattery}
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
            onPress={onToggleNight}
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

      {/* ── Paused overlay — pulsing amber tint ── */}
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

      {/* ── Speed hero card ── */}
      <Animated.View
        entering={FadeInUp.delay(50).duration(250)}
        style={{
          marginHorizontal: 20,
          marginTop: 16,
          borderRadius: 20,
          borderCurve: 'continuous',
          backgroundColor: palette.cardDark,
          overflow: 'hidden',
        }}
      >
        {/* Warm gradient top border glow */}
        <View
          style={{
            height: 3,
            backgroundColor: palette.signature500,
            opacity: 0.6,
          }}
        />

        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          {/* Kicker */}
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.5,
              color: labelColor,
              textTransform: 'uppercase',
            }}
          >
            Speed · {unitLabel}
          </Text>

          {/* Speed row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 12,
              marginTop: 4,
            }}
          >
            {/* Massive speed number */}
            <Text
              style={{
                fontSize: 124,
                fontWeight: '200',
                fontVariant: ['tabular-nums'],
                color: textColor,
                lineHeight: 124,
                includeFontPadding: false,
                letterSpacing: -4,
                opacity: isPaused ? 0.35 : 1,
              }}
              accessibilityRole="text"
              accessibilityLabel={`Current speed: ${displaySpeed} ${unitLabel}`}
            >
              {displaySpeed}
            </Text>

            {/* Max speed */}
            <View style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1,
                  color: mutedColor,
                  textTransform: 'uppercase',
                }}
              >
                MAX
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                  color: isNightMode ? palette.nightText : palette.signature400,
                  marginTop: 2,
                }}
              >
                {displayMaxSpeed}
              </Text>
            </View>
          </View>

          {/* Live sparkline */}
          <View style={{ marginTop: 8 }}>
            <HudSparkline
              data={sparklineMode === 'speed' ? speedHistory : altitudeHistory}
              mode={sparklineMode}
              isNightMode={isNightMode}
              onToggleMode={onToggleSparkline}
            />
          </View>
        </View>
      </Animated.View>

      {/* ── Map section ── */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(300)}
        style={{
          flex: 1,
          minHeight: 200,
          marginHorizontal: 20,
          marginTop: 12,
          borderRadius: 16,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: palette.surfaceElevated,
          overflow: 'hidden',
        }}
      >
        <HudMap waypoints={liveWaypoints} gpsAccuracy={gpsAccuracy} />

        {/* Distance pill overlay */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            backgroundColor: 'rgba(0,0,0,0.7)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            borderCurve: 'continuous',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              color: palette.white,
            }}
          >
            {formatDistance(distance, system)}
          </Text>
        </View>
      </Animated.View>

      {/* ── Stat strip — 4 columns ── */}
      <Animated.View
        entering={FadeInUp.delay(150).duration(250)}
        style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          marginTop: 12,
          backgroundColor: palette.surfaceHover,
          borderRadius: 14,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        <StatCell
          label="DIST"
          value={formatDistance(distance, system)}
          textColor={textColor}
          labelColor={labelColor}
        />
        <StatDivider isNightMode={isNightMode} />
        <StatCell
          label="AVG"
          value={formatSpeed(avgSpeedDisplay, system)}
          textColor={textColor}
          labelColor={labelColor}
        />
        <StatDivider isNightMode={isNightMode} />
        <StatCell
          label="GAIN"
          value={formatElevation(elevationGain, system)}
          textColor={textColor}
          labelColor={labelColor}
        />
        <StatDivider isNightMode={isNightMode} />
        <StatCell
          label="ALT"
          value={formatElevation(currentAltitude, system)}
          textColor={textColor}
          labelColor={labelColor}
        />
      </Animated.View>

      {/* ── Controls ── */}
      <View style={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}>
        <HudControls
          onPause={onPause}
          onResume={onResume}
          onEndRide={onEndRide}
          isPaused={isPaused}
          isNightMode={isNightMode}
        />
      </View>
    </View>
  );
}

// ── Internal sub-components ──

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
          fontSize: 18,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          color: textColor,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: labelColor,
          letterSpacing: 1,
          marginTop: 2,
        }}
      >
        {label}
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
