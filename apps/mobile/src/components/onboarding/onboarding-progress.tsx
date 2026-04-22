import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from './onboarding-colors';

interface OnboardingProgressProps {
  screenIndex: number;
  totalScreens: number;
}

/**
 * Editorial onboarding progress — segmented bar with warm accent.
 * Shows current step out of total as filled segments.
 */
export function OnboardingProgress({ screenIndex, totalScreens }: OnboardingProgressProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 24,
        paddingTop: insets.top + 12,
      }}
    >
      {Array.from({ length: totalScreens }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            borderCurve: 'continuous',
            backgroundColor:
              i <= screenIndex ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.surface2,
          }}
        />
      ))}
    </View>
  );
}
