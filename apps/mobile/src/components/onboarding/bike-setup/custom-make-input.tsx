import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { useOnboardingColors } from '../onboarding-colors';
import { PickerLabel } from './picker-ui';

/** The "Other make" name field on the onboarding bike step. */
export function CustomMakeInput({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  return (
    <View>
      <PickerLabel>{t('onboarding.v2BikeSetupMakeName')}</PickerLabel>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('onboarding.v2BikeSetupMakeNamePlaceholder')}
        placeholderTextColor={oc.textMuted}
        accessibilityLabel={t('onboarding.v2BikeSetupMakeName')}
        autoCapitalize="words"
        maxLength={50}
        autoFocus
        selectionColor={oc.warm}
        style={[
          type.body,
          {
            minHeight: 52,
            paddingHorizontal: space.md,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            backgroundColor: oc.surface,
            color: oc.textPrimary,
          },
        ]}
      />
    </View>
  );
}
