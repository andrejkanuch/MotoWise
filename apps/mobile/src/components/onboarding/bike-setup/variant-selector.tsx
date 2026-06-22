import { MotorcycleVariant } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { triggerImpact } from '../../../utils/haptics';
import { ONBOARDING_COLORS } from '../onboarding-colors';

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
  accent: string;
}

export function VariantSelector({ value, onChange, accent }: VariantSelectorProps) {
  const { t } = useTranslation();

  return (
    <Animated.View entering={FadeIn.duration(260)}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: ONBOARDING_COLORS.textLabel,
          marginBottom: 8,
          paddingLeft: 2,
        }}
      >
        {t('onboarding.v2BikeSetupVariantLabel')}
      </Text>
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
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={t(opt.labelKey)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? `${accent}24` : ONBOARDING_COLORS.surfaceInput,
                borderWidth: 1.5,
                borderColor: selected ? accent : ONBOARDING_COLORS.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontSize: 13.5,
                  fontWeight: '600',
                  letterSpacing: -0.1,
                  color: selected ? accent : ONBOARDING_COLORS.textSoft,
                }}
              >
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text
        style={{
          fontSize: 12,
          color: ONBOARDING_COLORS.textFaded,
          lineHeight: 17,
          marginTop: 8,
          paddingLeft: 2,
        }}
      >
        {t('onboarding.v2BikeSetupVariantHelper')}
      </Text>
    </Animated.View>
  );
}
