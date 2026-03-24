import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Pause, Play } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const LONG_PRESS_DURATION = 2000;

interface HudControlsProps {
  onPause: () => void;
  onResume: () => void;
  onEndRide: () => void;
  isPaused: boolean;
  isNightMode: boolean;
}

export function HudControls({
  onPause,
  onResume,
  onEndRide,
  isPaused,
  isNightMode,
}: HudControlsProps) {
  const progress = useSharedValue(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPressed = useRef(false);

  const accentColor = isNightMode ? palette.nightText : palette.white;
  const endBg = isNightMode ? palette.nightAccent : palette.danger500;

  const handlePauseResume = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    if (isPaused) {
      onResume();
    } else {
      onPause();
    }
  }, [isPaused, onPause, onResume]);

  const handleEndPressIn = useCallback(() => {
    isPressed.current = true;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    progress.value = withTiming(1, {
      duration: LONG_PRESS_DURATION,
      easing: Easing.linear,
    });
    pressTimer.current = setTimeout(() => {
      if (isPressed.current) {
        if (process.env.EXPO_OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        onEndRide();
      }
    }, LONG_PRESS_DURATION);
  }, [onEndRide, progress]);

  const handleEndPressOut = useCallback(() => {
    isPressed.current = false;
    progress.value = withTiming(0, { duration: 200 });
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, [progress]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const PauseResumeIcon = isPaused ? Play : Pause;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
      }}
    >
      {/* Pause / Resume */}
      <Pressable
        onPress={handlePauseResume}
        accessibilityRole="button"
        accessibilityLabel={isPaused ? 'Resume ride' : 'Pause ride'}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          borderCurve: 'continuous',
          backgroundColor: palette.controlBgActive,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PauseResumeIcon size={28} color={accentColor} strokeWidth={2.5} />
      </Pressable>

      {/* End Ride (long-press) */}
      <Pressable
        onPressIn={handleEndPressIn}
        onPressOut={handleEndPressOut}
        accessibilityRole="button"
        accessibilityLabel="Hold to end ride"
        accessibilityHint="Press and hold for 2 seconds to finish your ride"
        style={{
          height: 64,
          minWidth: 160,
          borderRadius: 32,
          borderCurve: 'continuous',
          backgroundColor: endBg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Progress fill */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              backgroundColor: palette.surfaceProgressFill,
            },
            progressStyle,
          ]}
        />
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: palette.white,
            letterSpacing: 1,
          }}
        >
          HOLD TO END
        </Text>
      </Pressable>
    </View>
  );
}
