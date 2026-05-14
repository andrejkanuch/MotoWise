import { useTranslation } from 'react-i18next';
import { Text, TextInput } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../onboarding-colors';

const currentYear = new Date().getFullYear();

interface YearInputProps {
  value: string;
  onChange: (value: string) => void;
  isValid: boolean;
}

export function YearInput({ value, onChange, isValid }: YearInputProps) {
  const { t } = useTranslation();
  const showError = value.length === 4 && !isValid;

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(300)}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: ONBOARDING_COLORS.textLabel,
          marginBottom: 12,
          paddingLeft: 2,
        }}
      >
        {t('onboarding.v2YearLabel')}
      </Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
        placeholder={String(currentYear - 3)}
        placeholderTextColor={ONBOARDING_COLORS.textDimmed}
        keyboardType="number-pad"
        maxLength={4}
        accessibilityLabel="Motorcycle year"
        style={{
          width: '100%',
          textAlign: 'center',
          backgroundColor: ONBOARDING_COLORS.surfaceInput,
          borderWidth: 1.5,
          borderColor: showError
            ? ONBOARDING_COLORS.error
            : isValid
              ? ONBOARDING_COLORS.warm
              : ONBOARDING_COLORS.borderSubtle,
          borderRadius: 16,
          borderCurve: 'continuous',
          padding: 18,
          color: ONBOARDING_COLORS.textPrimary,
          fontSize: 32,
          fontWeight: '700',
          letterSpacing: 4,
        }}
      />
      {showError && (
        <Text
          style={{ marginTop: 8, fontSize: 12.5, color: ONBOARDING_COLORS.error, paddingLeft: 2 }}
        >
          {t('onboarding.bikeYearInvalid', {
            defaultValue: `Enter a year between 1970 and ${currentYear + 1}`,
          })}
        </Text>
      )}
    </Animated.View>
  );
}
