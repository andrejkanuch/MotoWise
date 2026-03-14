import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';

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
      <Text
        style={{
          fontSize: 12,
          color: DIAGNOSTIC_COLORS.textMuted,
          marginBottom: 4,
        }}
      >
        {t('diagnoseV2.stepOf', { current: currentStep, total: totalSteps })}
      </Text>
      <View
        style={{
          height: 6,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 999,
              backgroundColor: DIAGNOSTIC_COLORS.accent,
            },
            animatedWidth,
          ]}
        />
      </View>
    </View>
  );
}
