import { router } from 'expo-router';
import { Bell, Coins, Globe, Lock, Map as MapIcon, Palette, Ruler } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { APP_PREFERENCE_KEY, type AppPreferenceKey } from '@/components/profile/constants';
import { useAppPreferences } from '@/components/profile/use-app-preferences';
import { ESettingsGroup, ESettingsRow } from '@/components/ui/editorial';
import { PROFILE_ROUTE } from '@/config/routes';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, readableWidth, space } from '@/theme/type';

const PREFERENCE_ROWS = [
  { key: APP_PREFERENCE_KEY.LANGUAGE, icon: Globe },
  { key: APP_PREFERENCE_KEY.THEME, icon: Palette },
  { key: APP_PREFERENCE_KEY.UNITS, icon: Ruler },
  { key: APP_PREFERENCE_KEY.CURRENCY, icon: Coins },
  { key: APP_PREFERENCE_KEY.RIDE_MAP, icon: MapIcon },
] as const;

/** App settings: device + account preferences, each opening its own choice list. */
export default function AppSettingsScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const preferences = useAppPreferences();

  const openPreference = (key: AppPreferenceKey) =>
    router.push({ pathname: PROFILE_ROUTE.PREFERENCE, params: { key } });

  return (
    <ScrollView
      testID="app-settings-screen"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        ...readableWidth,
        paddingHorizontal: GUTTER,
        paddingTop: space.md,
        paddingBottom: space.xxxl,
        gap: space.xl,
      }}
    >
      <ESettingsGroup>
        {PREFERENCE_ROWS.map(({ key, icon }) => (
          <ESettingsRow
            key={key}
            testID={`app-settings-${key}`}
            icon={icon}
            title={preferences[key].title}
            value={preferences[key].selectedLabel}
            onPress={() => openPreference(key)}
          />
        ))}
      </ESettingsGroup>

      <ESettingsGroup>
        <ESettingsRow
          testID="app-settings-notifications"
          icon={Bell}
          title={t('notifications.title')}
          onPress={() => router.push(PROFILE_ROUTE.NOTIFICATIONS)}
        />
        <ESettingsRow
          testID="app-settings-privacy"
          icon={Lock}
          title={t('privacy.title')}
          onPress={() => router.push(PROFILE_ROUTE.PRIVACY)}
        />
      </ESettingsGroup>
    </ScrollView>
  );
}
