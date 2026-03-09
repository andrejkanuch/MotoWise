import { View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OnboardingProgressProps {
  screenIndex: number;
  totalScreens: number;
}

export function OnboardingProgress({ screenIndex, totalScreens }: OnboardingProgressProps) {
  const insets = useSafeAreaInsets();
  // Endowed progress: starts at 10%, fills to 100%
  const progress = 0.1 + (0.9 * screenIndex) / totalScreens;

  const animatedWidth = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%`, { duration: 300 }),
  }));

  return (
    <View style={{ paddingHorizontal: 24, paddingTop: insets.top + 12 }}>
      <View
        style={{
          height: 4,
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 2,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: 2,
              borderCurve: 'continuous',
            },
            animatedWidth,
          ]}
        />
      </View>
    </View>
  );
}
