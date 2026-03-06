import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const STEP_KEYS = ['s1', 's2', 's3', 's4'] as const;

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
  return (
    <Animated.View
      entering={FadeIn.delay(100).duration(400)}
      style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 60 }}
    >
      {STEP_KEYS.slice(0, total).map((key, i) => (
        <StepDot key={key} active={i < step} />
      ))}
    </Animated.View>
  );
}
