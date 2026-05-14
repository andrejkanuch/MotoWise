import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import { Moon, Sun } from 'lucide-react-native';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import {
  distanceUnitLabel,
  elevationUnitLabel,
  formatDistanceValue,
  formatElapsed,
  formatElevationValue,
  formatSpeedValue,
  speedUnitLabel,
} from '../../utils/ride-formatters';
import { HudControls } from './hud-controls';
import { HudMap } from './hud-map';

// TODO: Import from ./hud-layout-a once it exists
// import type { HudLayoutProps } from './hud-layout-a';

export interface HudLayoutProps {
  /** Ride status — 'recording' or 'paused' */
  isPaused: boolean;
  /** Night mode enabled */
  isNightMode: boolean;
  /** Elapsed ride time in seconds */
  elapsedSeconds: number;
  /** Current speed in m/s */
  currentSpeed: number;
  /** Distance traveled in meters */
  distance: number;
  /** Average speed in m/s (derived) */
  avgSpeed: number;
  /** Max speed in m/s */
  maxSpeed: number;
  /** Elevation gain in meters */
  elevationGain: number;
  /** GPS accuracy in meters */
  gpsAccuracy: number;
  /** Live route waypoints */
  liveWaypoints: Waypoint[];
  /** Callbacks */
  onPause: () => void;
  onResume: () => void;
  onEndRide: () => void;
  onToggleNight: () => void;
}

export function HudLayoutB({
  isPaused,
  isNightMode,
  elapsedSeconds,
  currentSpeed,
  distance,
  avgSpeed,
  maxSpeed,
  elevationGain,
  gpsAccuracy,
  liveWaypoints,
  onPause,
  onResume,
  onEndRide,
  onToggleNight,
}: HudLayoutProps) {
  const insets = useSafeAreaInsets();
  const system = useMeasurementSystem();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark' || isNightMode;

  const frostedBg = isDark ? 'rgba(10,9,7,0.78)' : 'rgba(248,246,242,0.82)';
  const frostedText = isDark ? palette.white : palette.neutral950;
  const frostedMuted = isDark ? palette.neutral500 : palette.neutral400;

  const statusDotColor = isPaused ? palette.warning500 : palette.success500;
  const statusLabel = isPaused ? 'PAUSED' : 'REC';

  const displaySpeed = formatSpeedValue(currentSpeed, system);
  const speedUnit = speedUnitLabel(system);

  return (
    <View style={{ flex: 1, backgroundColor: palette.neutral950 }}>
      {/* Full-bleed map background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <HudMap waypoints={liveWaypoints} gpsAccuracy={gpsAccuracy} />
      </View>

      {/* Floating status pill (top center) */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: frostedBg,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 24,
          borderCurve: 'continuous',
          zIndex: 20,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: statusDotColor,
          }}
        />
        <Text
          style={{
            fontSize: 12,
            fontWeight: '800',
            color: statusDotColor,
            letterSpacing: 1.2,
          }}
        >
          {statusLabel}
        </Text>
        <View
          style={{
            width: 1,
            height: 14,
            backgroundColor: isDark ? palette.surfaceElevated : palette.neutral200,
          }}
        />
        <Text
          style={{
            fontSize: 14,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
            color: frostedText,
          }}
        >
          {formatElapsed(elapsedSeconds)}
        </Text>
      </Animated.View>

      {/* Night toggle (top right) */}
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          right: 16,
          zIndex: 20,
        }}
      >
        <Pressable
          onPress={onToggleNight}
          accessibilityRole="switch"
          accessibilityLabel="Night mode"
          accessibilityState={{ checked: isNightMode }}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            borderCurve: 'continuous',
            backgroundColor: frostedBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isNightMode ? (
            <Sun size={18} color={palette.nightText} />
          ) : (
            <Moon size={18} color={frostedMuted} />
          )}
        </Pressable>
      </Animated.View>

      {/* Floating speed pill (centered, above bottom sheet) */}
      <Animated.View
        entering={FadeIn.delay(100).duration(250)}
        style={{
          position: 'absolute',
          bottom: 280,
          alignSelf: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(12,11,9,0.85)',
          paddingHorizontal: 32,
          paddingVertical: 12,
          borderRadius: 22,
          borderCurve: 'continuous',
          zIndex: 15,
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontWeight: '700',
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {speedUnit}
        </Text>
        <Text
          style={{
            fontSize: 56,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
            color: palette.white,
            lineHeight: 60,
          }}
        >
          {displaySpeed}
        </Text>
      </Animated.View>

      {/* Bottom sheet area */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: frostedBg,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderCurve: 'continuous',
          paddingBottom: insets.bottom + 16,
          zIndex: 10,
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 14 }}>
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: isDark ? palette.surfaceElevated : palette.neutral300,
            }}
          />
        </View>

        {/* 4-column stat grid */}
        <View
          style={{
            flexDirection: 'row',
            marginHorizontal: 20,
            marginBottom: 20,
          }}
        >
          <StatCell
            label="Dist"
            value={formatDistanceValue(distance, system)}
            unit={distanceUnitLabel(system)}
            textColor={frostedText}
            mutedColor={frostedMuted}
          />
          <StatDivider color={isDark ? palette.surfaceElevated : palette.neutral200} />
          <StatCell
            label="Avg"
            value={String(formatSpeedValue(avgSpeed, system))}
            unit={speedUnitLabel(system)}
            textColor={frostedText}
            mutedColor={frostedMuted}
          />
          <StatDivider color={isDark ? palette.surfaceElevated : palette.neutral200} />
          <StatCell
            label="Max"
            value={String(formatSpeedValue(maxSpeed, system))}
            unit={speedUnitLabel(system)}
            textColor={frostedText}
            mutedColor={frostedMuted}
          />
          <StatDivider color={isDark ? palette.surfaceElevated : palette.neutral200} />
          <StatCell
            label="Gain"
            value={String(formatElevationValue(elevationGain, system))}
            unit={elevationUnitLabel(system)}
            textColor={frostedText}
            mutedColor={frostedMuted}
          />
        </View>

        {/* Pause + Stop controls */}
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

function StatCell({
  label,
  value,
  unit,
  textColor,
  mutedColor,
}: {
  label: string;
  value: string;
  unit: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 17,
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
          fontWeight: '600',
          color: mutedColor,
          letterSpacing: 0.5,
          marginTop: 2,
        }}
      >
        {label} ({unit})
      </Text>
    </View>
  );
}

function StatDivider({ color }: { color: string }) {
  return <View style={{ width: 1, marginVertical: 4, backgroundColor: color }} />;
}
