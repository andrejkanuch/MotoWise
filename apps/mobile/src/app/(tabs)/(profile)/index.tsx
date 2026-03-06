import { palette } from '@motolearn/design-system';
import { MeDocument } from '@motolearn/graphql';
import type { SupportedLocale } from '@motolearn/types';
import { SUPPORTED_LOCALES } from '@motolearn/types';
import {
  ChevronRight,
  CreditCard,
  Crown,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Settings,
  Star,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'urql';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/auth.store';

const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
};

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;
const THEME_LABEL_KEYS = {
  system: 'profile.themeSystem',
  light: 'profile.themeLight',
  dark: 'profile.themeDark',
} as const;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    locale,
    setLocale,
    colorScheme: storedScheme,
    setColorScheme: setStoredScheme,
  } = useAuthStore();
  const { setColorScheme } = useColorScheme();

  const [meResult] = useQuery({ query: MeDocument });
  const user = meResult.data?.me;
  const preferences = user?.preferences as
    | { experienceLevel?: string; ridingGoals?: string[] }
    | null
    | undefined;

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleThemeChange = (value: 'system' | 'light' | 'dark') => {
    setStoredScheme(value);
    setColorScheme(value === 'system' ? undefined : value);
  };

  const experienceLevel = preferences?.experienceLevel ?? 'beginner';

  const SETTINGS_ITEMS = [
    { key: 'settings', icon: Settings, label: t('profile.settings') },
    { key: 'privacy', icon: Lock, label: t('profile.privacy') },
    { key: 'subscriptions', icon: CreditCard, label: t('profile.subscriptions') },
    { key: 'support', icon: HelpCircle, label: t('profile.support') },
  ];

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info */}
        <Animated.View entering={FadeIn.duration(300)} className="items-center px-5 pt-6 pb-2">
          <View
            className="w-20 h-20 rounded-full bg-primary-500 items-center justify-center mb-3"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-white text-2xl font-bold">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text selectable className="text-xl font-bold text-neutral-950 dark:text-neutral-50">
            {user?.fullName ?? t('profile.rider')}
          </Text>
          <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 capitalize">
            {experienceLevel} {t('profile.rider')}
          </Text>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          className="flex-row px-5 mt-4 gap-3"
        >
          {[
            { label: t('profile.level'), value: '3' },
            { label: t('profile.rank'), value: 'Pro' },
            { label: t('profile.badges'), value: '5' },
          ].map((stat) => (
            <View
              key={stat.label}
              className="flex-1 bg-white dark:bg-neutral-800 rounded-2xl p-4 items-center"
              style={{ borderCurve: 'continuous' }}
            >
              <Text
                selectable
                className="text-xl font-bold text-neutral-950 dark:text-neutral-50"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {stat.value}
              </Text>
              <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {stat.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* Pro Banner */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-5 mt-4">
          <Pressable
            className="bg-primary-950 dark:bg-primary-800 rounded-2xl p-5 flex-row items-center"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="w-10 h-10 rounded-xl bg-warning-500/20 items-center justify-center mr-3">
              <Crown size={20} color={palette.warning500} strokeWidth={2} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold">{t('profile.proBanner')}</Text>
              <Text className="text-white/60 text-sm mt-0.5">{t('profile.proDescription')}</Text>
            </View>
            <Star size={18} color={palette.warning500} strokeWidth={2} />
          </Pressable>
        </Animated.View>

        {/* Settings Menu */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-5 mt-5">
          <View
            className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden"
            style={{ borderCurve: 'continuous' }}
          >
            {SETTINGS_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.key}
                  className="flex-row items-center px-4 py-4"
                  style={
                    index < SETTINGS_ITEMS.length - 1
                      ? { borderBottomWidth: 1, borderBottomColor: palette.neutral100 }
                      : undefined
                  }
                >
                  <Icon size={20} color={palette.neutral500} strokeWidth={1.8} />
                  <Text className="flex-1 text-base text-neutral-950 dark:text-neutral-50 ml-3">
                    {item.label}
                  </Text>
                  <ChevronRight size={18} color={palette.neutral400} strokeWidth={2} />
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Language Picker */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)} className="px-5 mt-5">
          <View className="flex-row items-center gap-2 mb-3">
            <Globe size={16} color={palette.neutral500} strokeWidth={2} />
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {t('profile.language')}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {SUPPORTED_LOCALES.map((loc) => (
              <Pressable
                key={loc}
                className={`flex-1 rounded-xl p-3 items-center ${
                  locale === loc ? 'bg-primary-500' : 'bg-white dark:bg-neutral-800'
                }`}
                style={{ borderCurve: 'continuous' }}
                onPress={() => setLocale(loc)}
              >
                <Text
                  className={`text-sm font-semibold ${
                    locale === loc ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {LOCALE_DISPLAY_NAMES[loc]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Theme Picker */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} className="px-5 mt-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Moon size={16} color={palette.neutral500} strokeWidth={2} />
            <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              {t('profile.theme')}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {THEME_OPTIONS.map((value) => (
              <Pressable
                key={value}
                className={`flex-1 rounded-xl p-3 items-center ${
                  storedScheme === value ? 'bg-primary-500' : 'bg-white dark:bg-neutral-800'
                }`}
                style={{ borderCurve: 'continuous' }}
                onPress={() => handleThemeChange(value)}
              >
                <Text
                  className={`text-sm font-semibold ${
                    storedScheme === value ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {t(THEME_LABEL_KEYS[value])}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Logout */}
        <Animated.View entering={FadeInUp.delay(450).duration(400)} className="px-5 mt-5">
          <Pressable
            className="flex-row items-center justify-center bg-white dark:bg-neutral-800 rounded-2xl p-4 gap-2"
            style={{ borderCurve: 'continuous' }}
            onPress={handleLogout}
          >
            <LogOut size={18} color={palette.danger500} strokeWidth={2} />
            <Text className="text-danger-500 text-base font-semibold">{t('auth.signOut')}</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
