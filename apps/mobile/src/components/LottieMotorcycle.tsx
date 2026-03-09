import LottieView from 'lottie-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

const ANIMATIONS = {
  emptyGarage: require('../assets/animations/bouncing-motorbike.json'),
  cardPlaceholder: require('../assets/animations/motorcycle-card-placeholder.json'),
} as const;

type AnimationName = keyof typeof ANIMATIONS;

export function LottieMotorcycle({
  animation,
  size = 120,
  autoPlay = true,
  loop = false,
  speed = 1,
  style,
}: {
  animation: AnimationName;
  size?: number;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const source = ANIMATIONS[animation];
  const aspectRatio = animation === 'cardPlaceholder' ? 200 / 120 : 1;

  return (
    <LottieView
      source={source}
      autoPlay={autoPlay}
      loop={loop}
      speed={speed}
      style={[{ width: size, height: size / aspectRatio }, style]}
    />
  );
}
