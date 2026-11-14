import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { space } from '../../theme/spacing';
import { radius, type } from '../../theme/type';
import { useOnboardingColors } from './onboarding-colors';

/** The account step's "Pro" pill, shown to riders who just purchased. */
export function AccountProBadge() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xxs,
        minHeight: 28,
        paddingHorizontal: space.sm,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        backgroundColor: oc.surface2,
        marginBottom: space.lg,
      }}
    >
      <Text style={[type.label, { color: oc.textPrimary }]}>
        {t('onboarding.obAccountProBadge')}
      </Text>
    </View>
  );
}
