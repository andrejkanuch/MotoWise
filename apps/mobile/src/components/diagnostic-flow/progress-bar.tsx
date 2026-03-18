import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useDiagnosticColors } from './diagnostic-colors';

const STEP_LABELS = ['Bike', 'Symptoms', 'Photo', 'Review'] as const;

interface DiagnosticProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function DiagnosticProgressBar({ currentStep, totalSteps }: DiagnosticProgressBarProps) {
  const { t } = useTranslation();
  const colors = useDiagnosticColors();

  const animatedWidth = useAnimatedStyle(() => ({
    width: withTiming(`${(currentStep / totalSteps) * 100}%`, { duration: 250 }),
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('diagnoseV2.stepOf', { current: currentStep, total: totalSteps })}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
    >
      {/* Step label */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
          {STEP_LABELS[currentStep - 1] ?? ''}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>
          {currentStep}/{totalSteps}
        </Text>
      </View>

      {/* Bar */}
      <View
        style={{
          height: 4,
          backgroundColor: colors.progressTrack,
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 999,
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
              shadowOpacity: 0.5,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            },
            animatedWidth,
          ]}
        />
      </View>
    </View>
  );
}
