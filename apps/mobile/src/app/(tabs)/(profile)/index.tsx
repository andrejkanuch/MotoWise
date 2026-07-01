import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { AccountSection } from '../../../components/profile/account-section';
import { DangerZoneSection } from '../../../components/profile/danger-zone-section';
import { PreferencesSection } from '../../../components/profile/preferences-section';
import { SubscriptionSection } from '../../../components/profile/subscription-section';
import { useProGate } from '../../../hooks/use-pro-gate';
import { useProfileData } from '../../../hooks/use-profile-data';
import { useEditorialTheme } from '../../../theme/editorial';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { t: theme } = useEditorialTheme();
  const isDark = colorScheme === 'dark';
  const { isPro } = useProGate();

  const {
    user,
    motorcycles,
    updatePreferenceMutation,
    handleAddBike,
    handleLogout,
    handleDeleteAccount,
  } = useProfileData({ t, isPro });

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      <AccountSection
        user={user}
        motorcycles={motorcycles}
        isPro={isPro}
        isDark={isDark}
        onAddBike={handleAddBike}
      />
      <SubscriptionSection isPro={isPro} isDark={isDark} />
      <PreferencesSection isDark={isDark} updatePreferenceMutation={updatePreferenceMutation} />
      <DangerZoneSection
        isDark={isDark}
        onLogout={handleLogout}
        onDeleteAccount={handleDeleteAccount}
      />
    </ScrollView>
  );
}
