import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useProGate } from '../../../hooks/use-pro-gate';
import { useEditorialTheme } from '../../../theme/editorial';
import { AccountSection } from './components/account-section';
import { DangerZoneSection } from './components/danger-zone-section';
import { PreferencesSection } from './components/preferences-section';
import { SubscriptionSection } from './components/subscription-section';
import { useProfileData } from './use-profile-data';

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
