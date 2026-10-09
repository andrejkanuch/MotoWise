import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { radius, space, type } from '../../../theme/type';
import { useOnboardingColors } from '../onboarding-colors';

const MIN_YEAR = 1970;
const MAX_YEAR = new Date().getFullYear() + 1;

interface YearStepperProps {
  /** Current year as a string (mirrors the parent's text state). */
  value: string;
  /** Emits the new year string when stepped. */
  onChange: (year: string) => void;
  /** Haptic/side-effect hook fired on a successful step. */
  onStep?: () => void;
}

const labelStyle = {
  ...type.label,
  marginBottom: space.sm,
  paddingLeft: 2,
};

/**
 * Model-year stepper — `< 2023 >` with the year centered as a condensed figure.
 * Replaces the empty-state year box: year is only set once a make is picked
 * (design: bike-setup "selected" state).
 */
export function YearStepper({ value, onChange, onStep }: YearStepperProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const year = Number.parseInt(value, 10) || MAX_YEAR - 1;
  const canDecrement = year > MIN_YEAR;
  const canIncrement = year < MAX_YEAR;

  const step = (delta: number) => {
    const next = year + delta;
    if (next < MIN_YEAR || next > MAX_YEAR) return;
    onStep?.();
    onChange(String(next));
  };

  return (
    <View>
      <Text style={[labelStyle, { color: oc.textLabel }]}>
        {t('onboarding.v2BikeSetupYearCompact')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: oc.surfaceInput,
          borderWidth: 1,
          borderColor: oc.borderSubtle,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          paddingHorizontal: 10,
          paddingVertical: 8,
        }}
      >
        <StepButton direction="prev" disabled={!canDecrement} onPress={() => step(-1)} />
        <Text style={[type.figure, { color: oc.textPrimary }]}>{value}</Text>
        <StepButton direction="next" disabled={!canIncrement} onPress={() => step(1)} />
      </View>
    </View>
  );
}

function StepButton({
  direction,
  disabled,
  onPress,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onPress: () => void;
}) {
  const oc = useOnboardingColors();
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={direction === 'prev' ? 'Previous year' : 'Next year'}
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        backgroundColor: oc.surfaceCardTranslucent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Icon size={20} color={oc.textPrimary} />
    </Pressable>
  );
}
