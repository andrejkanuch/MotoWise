import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function StepDot({ active }: { active: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(active ? '#FFFFFF' : 'rgba(255,255,255,0.25)', { duration: 300 }),
    transform: [{ scaleY: withTiming(active ? 1 : 0.8, { duration: 200 }) }],
  }));

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          height: 4,
          borderRadius: 2,
          borderCurve: 'continuous',
        },
        animatedStyle,
      ]}
    />
  );
}

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(300)}
      style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: insets.top + 12 }}
    >
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static list of dots, never reordered
        <StepDot key={i} active={i < step} />
      ))}
    </Animated.View>
  );
}
