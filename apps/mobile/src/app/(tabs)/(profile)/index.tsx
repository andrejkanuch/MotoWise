import { palette } from '@motolearn/design-system';
import { MeDocument } from '@motolearn/graphql';
import type { SupportedLocale } from '@motolearn/types';
import { SUPPORTED_LOCALES } from '@motolearn/types';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronRight,
  Crown,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Palette,
  Settings,
  Shield,
  Star,
  Sun,
  Zap,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useQuery } from 'urql';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/auth.store';

const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
};

const THEME_OPTIONS = ['system', 'light', 'dark'] as const;
const THEME_ICONS = { system: Palette, light: Sun, dark: Moon } as const;
const THEME_LABEL_KEYS = {
  system: 'profile.themeSystem',
  light: 'profile.themeLight',
  dark: 'profile.themeDark',
} as const;

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color: palette.neutral500,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {label}
    </Text>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  onPress,
  isLast,
  isDark,
  color,
}: {
  icon: typeof Settings;
  label: string;
  onPress?: () => void;
  isLast?: boolean;
  isDark: boolean;
  color?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed
          ? isDark
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.03)'
          : 'transparent',
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          borderCurve: 'continuous',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={17} color={color ?? palette.neutral500} strokeWidth={1.8} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 16,
          color: color ?? (isDark ? palette.neutral50 : palette.neutral950),
          marginLeft: 12,
        }}
      >
        {label}
      </Text>
      {!color && <ChevronRight size={17} color={palette.neutral400} strokeWidth={2} />}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const {
    locale,
    setLocale,
    colorScheme: storedScheme,
    setColorScheme: setStoredScheme,
  } = useAuthStore();
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [meResult] = useQuery({ query: MeDocument });
  const user = meResult.data?.me;
  const preferences = user?.preferences as
    | { experienceLevel?: string; ridingGoals?: string[] }
    | null
    | undefined;

  const handleLogout = async () => {
    haptic();
    await supabase.auth.signOut();
  };

  const handleThemeChange = (value: 'system' | 'light' | 'dark') => {
    haptic();
    setStoredScheme(value);
    setColorScheme(value === 'system' ? undefined : value);
  };

  const experienceLevel = preferences?.experienceLevel ?? 'beginner';
  const initials =
    user?.fullName
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* User Card */}
      <Animated.View entering={FadeInUp.duration(400)}>
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 24,
            alignItems: 'center',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              borderCurve: 'continuous',
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <LinearGradient
              colors={[palette.primary500, palette.primary700]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28, fontWeight: '700', color: palette.white }}>
                {initials}
              </Text>
            </LinearGradient>
          </View>

          <Text
            selectable
            style={{
              fontSize: 22,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {user?.fullName ?? t('profile.rider')}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: palette.neutral500,
              marginTop: 4,
              textTransform: 'capitalize',
            }}
          >
            {experienceLevel} {t('profile.rider')}
          </Text>

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 20,
              gap: 12,
              alignSelf: 'stretch',
            }}
          >
            {[
              { label: t('profile.level'), value: '3', icon: Zap, color: palette.primary500 },
              { label: t('profile.rank'), value: 'Pro', icon: Shield, color: palette.accent500 },
              { label: t('profile.badges'), value: '5', icon: Star, color: palette.warning500 },
            ].map((stat) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : palette.neutral50,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  paddingVertical: 14,
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <stat.icon size={16} color={stat.color} strokeWidth={2} />
                <Text
                  selectable
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: isDark ? palette.neutral50 : palette.neutral950,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {stat.value}
                </Text>
                <Text style={{ fontSize: 11, color: palette.neutral500, fontWeight: '500' }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Pro Banner */}
      <Animated.View entering={FadeInUp.delay(80).duration(400)}>
        <Pressable
          onPress={haptic}
          style={{ borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[palette.gradientCTAStart, palette.gradientCTAEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 20,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Crown size={22} color={palette.warning500} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.white, fontSize: 17, fontWeight: '700' }}>
                {t('profile.proBanner')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>
                {t('profile.proDescription')}
              </Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.6)" strokeWidth={2} />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Settings */}
      <Animated.View entering={FadeInUp.delay(160).duration(400)}>
        <SectionHeader label={t('profile.settings')} />
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <SettingsRow icon={Settings} label={t('profile.settings')} isDark={isDark} />
          <SettingsRow icon={Lock} label={t('profile.privacy')} isDark={isDark} />
          <SettingsRow icon={HelpCircle} label={t('profile.support')} isDark={isDark} isLast />
        </View>
      </Animated.View>

      {/* Language */}
      <Animated.View entering={FadeInUp.delay(240).duration(400)}>
        <SectionHeader label={t('profile.language')} />
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            padding: 4,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {SUPPORTED_LOCALES.map((loc) => {
            const selected = locale === loc;
            return (
              <Pressable
                key={loc}
                onPress={() => {
                  haptic();
                  setLocale(loc);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  backgroundColor: selected
                    ? isDark
                      ? palette.primary700
                      : palette.primary500
                    : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: selected
                      ? palette.white
                      : isDark
                        ? palette.neutral400
                        : palette.neutral600,
                  }}
                >
                  {LOCALE_DISPLAY_NAMES[loc]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Theme */}
      <Animated.View entering={FadeInUp.delay(320).duration(400)}>
        <SectionHeader label={t('profile.theme')} />
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            padding: 4,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {THEME_OPTIONS.map((value) => {
            const selected = storedScheme === value;
            const ThemeIcon = THEME_ICONS[value];
            return (
              <Pressable
                key={value}
                onPress={() => handleThemeChange(value)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: selected
                    ? isDark
                      ? palette.primary700
                      : palette.primary500
                    : 'transparent',
                }}
              >
                <ThemeIcon
                  size={15}
                  color={
                    selected ? palette.white : isDark ? palette.neutral400 : palette.neutral600
                  }
                  strokeWidth={2}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: selected
                      ? palette.white
                      : isDark
                        ? palette.neutral400
                        : palette.neutral600,
                  }}
                >
                  {t(THEME_LABEL_KEYS[value])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Logout */}
      <Animated.View entering={FadeInUp.delay(400).duration(400)}>
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <SettingsRow
            icon={LogOut}
            label={t('auth.signOut')}
            onPress={handleLogout}
            isDark={isDark}
            color={palette.danger500}
            isLast
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
}
