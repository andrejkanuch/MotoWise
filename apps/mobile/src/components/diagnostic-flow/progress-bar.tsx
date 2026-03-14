import { palette } from '@motovault/design-system';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface DiagnosticProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function DiagnosticProgressBar({ currentStep, totalSteps }: DiagnosticProgressBarProps) {
  const { t } = useTranslation();

  const animatedWidth = useAnimatedStyle(() => ({
    width: withTiming(`${(currentStep / totalSteps) * 100}%`, { duration: 250 }),
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('diagnoseV2.stepOf', { current: currentStep, total: totalSteps })}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
    >
      <Text className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
        {t('diagnoseV2.stepOf', { current: currentStep, total: totalSteps })}
      </Text>
      <View className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <Animated.View
          className="h-full rounded-full"
          style={[{ backgroundColor: palette.primary500 }, animatedWidth]}
        />
      </View>
    </View>
  );
}
