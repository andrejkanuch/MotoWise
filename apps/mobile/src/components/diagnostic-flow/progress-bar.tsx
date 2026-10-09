import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, withTiming } from 'react-native-reanimated';
import { radius } from '../../theme/type';
import { useDiagnosticColors } from './diagnostic-colors';

const TRACK_HEIGHT = 3;
const FILL_MS = 250;

interface DiagnosticProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

/** A thin copper fill on a graphite track — the step title below names the step. */
export function DiagnosticProgressBar({ currentStep, totalSteps }: DiagnosticProgressBarProps) {
  const { t } = useTranslation();
  const colors = useDiagnosticColors();
  const reduceMotion = useReducedMotion();
  const fraction = `${(currentStep / totalSteps) * 100}%` as const;

  const animatedWidth = useAnimatedStyle(() => ({
    width: reduceMotion ? fraction : withTiming(fraction, { duration: FILL_MS }),
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('diagnoseV2.stepOf', { current: currentStep, total: totalSteps })}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep }}
      style={{
        height: TRACK_HEIGHT,
        backgroundColor: colors.progressTrack,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: radius.pill,
            borderCurve: 'continuous',
            backgroundColor: colors.accent,
          },
          animatedWidth,
        ]}
      />
    </View>
  );
}
