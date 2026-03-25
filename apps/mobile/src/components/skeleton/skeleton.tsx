import { palette } from '@motovault/design-system';
import { useColorScheme, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSkeletonProgress } from './skeleton-provider';

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, style }: SkeletonProps) {
  const progress = useSkeletonProgress();
  const isDark = useColorScheme() === 'dark';

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.4, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}
