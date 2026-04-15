import { palette } from '@motovault/design-system';
import { Bike } from 'lucide-react-native';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Lightweight replacement for lottie-react-native.
 * Shows a Bike icon with a gentle bounce animation.
 */
export function LottieMotorcycle({
  size = 120,
  loop = false,
  style,
}: {
  animation?: string;
  size?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(withTiming(-6, { duration: 600 }), withTiming(0, { duration: 600 })),
      loop ? -1 : 2,
      true,
    );
  }, [loop, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Animated.View style={animStyle}>
        <Bike size={size * 0.5} color={palette.neutral400} strokeWidth={1.5} />
      </Animated.View>
    </View>
  );
}
