import { MotorcycleVariant } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { radius, space, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';
import { useOnboardingColors } from '../onboarding-colors';
import { PickerLabel } from './picker-ui';

/**
 * Minimal drivetrain/trim selector (U7). Writes the bike's `variant` so the OEM
 * schedule waterfall can surface verified per-variant intervals (e.g. DCT).
 * `null` = "Not applicable" → matches the make+model baseline rows.
 *
 * Variant *derivation* (auto-suggesting DCT/MT from model metadata) is
 * explicitly deferred — this is the cheap capture half only.
 */

const OPTIONS = [
  { value: MotorcycleVariant.DCT, labelKey: 'onboarding.v2BikeSetupVariantDct' },
  { value: MotorcycleVariant.MT, labelKey: 'onboarding.v2BikeSetupVariantMt' },
  { value: null, labelKey: 'onboarding.v2BikeSetupVariantNone' },
] as const;

interface VariantSelectorProps {
  value: MotorcycleVariant | null;
  onChange: (variant: MotorcycleVariant | null) => void;
}

export function VariantSelector({ value, onChange }: VariantSelectorProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeIn.duration(260)}>
      <PickerLabel>{t('onboarding.v2BikeSetupVariantLabel')}</PickerLabel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value ?? 'none'}
              onPress={() => {
                triggerImpact();
                onChange(opt.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(opt.labelKey)}
              style={{
                flex: 1,
                minHeight: 44,
                paddingVertical: space.sm,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: oc.surface,
                borderWidth: 2,
                borderColor: selected ? oc.warm : 'transparent',
              }}
            >
              <Text
                style={[
                  type.label,
                  {
                    color: selected ? oc.textPrimary : oc.textSecondary,
                  },
                ]}
              >
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        style={[type.caption, { color: oc.textMuted, marginTop: space.xs, marginLeft: space.xxs }]}
      >
        {t('onboarding.v2BikeSetupVariantHelper')}
      </Text>
    </Animated.View>
  );
}
