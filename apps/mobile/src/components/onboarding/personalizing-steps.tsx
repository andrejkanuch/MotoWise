import { Check, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { tDynamic } from '../../i18n/t-dynamic';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { useOnboardingColors } from './onboarding-colors';

interface PersonalizingStepsProps {
  /** i18n keys under `onboarding.`, one per row. */
  steps: readonly string[];
  icons: readonly LucideIcon[];
  /** How many rows, from the top, are ticked off. */
  visibleSteps: number;
}

/** Calm progress readout of the personalizing screen: every step listed, each ticking off in turn. */
export function PersonalizingSteps({ steps, icons, visibleSteps }: PersonalizingStepsProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: oc.surface,
        overflow: 'hidden',
      }}
    >
      {steps.map((stepKey, index) => {
        const StepIcon = icons[index];
        const done = visibleSteps > index;
        return (
          <View
            key={stepKey}
            accessibilityState={{ checked: done }}
            style={{
              minHeight: 52,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: oc.line,
            }}
          >
            {StepIcon ? (
              <StepIcon size={18} color={done ? oc.textSecondary : oc.textDimmed} />
            ) : null}
            <Text style={[type.body, { flex: 1, color: done ? oc.textPrimary : oc.textMuted }]}>
              {tDynamic(t, `onboarding.${stepKey}`)}
            </Text>
            {done ? (
              <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(200)}>
                <Check size={18} color={oc.success} strokeWidth={2.6} />
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
