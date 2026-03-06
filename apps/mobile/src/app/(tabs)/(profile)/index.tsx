import type { SupportedLocale } from '@motolearn/types';
import { SUPPORTED_LOCALES } from '@motolearn/types';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/auth.store';

const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
};

const THEME_LABEL_KEYS = {
  system: 'profile.themeSystem',
  light: 'profile.themeLight',
  dark: 'profile.themeDark',
} as const;

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const {
    locale,
    setLocale,
    colorScheme: storedScheme,
    setColorScheme: setStoredScheme,
  } = useAuthStore();
  const { setColorScheme } = useColorScheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleThemeChange = (value: 'system' | 'light' | 'dark') => {
    setStoredScheme(value);
    setColorScheme(value);
  };

  return (
    <View className="flex-1 p-4 bg-white dark:bg-neutral-900">
      <Text className="text-2xl font-bold mb-4 text-neutral-950 dark:text-neutral-50">
        {t('profile.title')}
      </Text>

      <Text className="text-lg font-semibold mb-1 text-neutral-950 dark:text-neutral-50">
        {t('profile.language')}
      </Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.languageDescription')}
      </Text>
      <View className="flex-row gap-2 mb-6">
        {SUPPORTED_LOCALES.map((loc) => (
          <Pressable
            key={loc}
            className={`flex-1 rounded-xl p-4 items-center ${
              locale === loc ? 'bg-primary-500' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
            style={{ borderCurve: 'continuous' }}
            onPress={() => setLocale(loc)}
          >
            <Text
              className={`text-base font-semibold ${
                locale === loc ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {LOCALE_DISPLAY_NAMES[loc]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-lg font-semibold mb-1 text-neutral-950 dark:text-neutral-50">
        {t('profile.theme')}
      </Text>
      <Text className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        {t('profile.themeDescription')}
      </Text>
      <View className="flex-row gap-2 mb-6">
        {THEME_OPTIONS.map((value) => (
          <Pressable
            key={value}
            className={`flex-1 rounded-xl p-4 items-center ${
              storedScheme === value ? 'bg-primary-500' : 'bg-neutral-100 dark:bg-neutral-800'
            }`}
            style={{ borderCurve: 'continuous' }}
            onPress={() => handleThemeChange(value)}
          >
            <Text
              className={`text-base font-semibold ${
                storedScheme === value ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
              }`}
            >
              {t(THEME_LABEL_KEYS[value])}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        className="bg-danger-500 rounded-xl p-4 items-center"
        style={{ borderCurve: 'continuous' }}
        onPress={handleLogout}
      >
        <Text className="text-white text-base font-semibold">{t('auth.signOut')}</Text>
      </Pressable>
    </View>
  );
}
