import { LogOut, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ESettingsRow } from '../../../../components/ui/editorial';
import { tint, useEditorialTheme } from '../../../../theme/editorial';

export function DangerZoneSection({
  isDark,
  onLogout,
  onDeleteAccount,
}: {
  isDark: boolean;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  return (
    <>
      {/* Logout */}
      <Animated.View entering={FadeInUp.delay(580).duration(400)}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <ESettingsRow
            icon={LogOut}
            label={t('auth.signOut')}
            onPress={onLogout}
            color={theme.danger}
            isLast
          />
        </View>
      </Animated.View>

      {/* Delete Account */}
      <Animated.View entering={FadeInUp.delay(560).duration(400)}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <ESettingsRow
            icon={Trash2}
            label={t('privacy.deleteAccount', { defaultValue: 'Delete Account' })}
            onPress={onDeleteAccount}
            color={theme.danger}
            isLast
          />
        </View>
      </Animated.View>
    </>
  );
}
