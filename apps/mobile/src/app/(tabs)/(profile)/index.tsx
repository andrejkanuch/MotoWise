import { palette } from '@motovault/design-system';
import { MeDocument, MyMotorcyclesDocument } from '@motovault/graphql';
import type { SupportedLocale } from '@motovault/types';
import { FREE_TIER_LIMITS, SUPPORTED_LOCALES } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Bell,
  Bike,
  ChevronRight,
  CreditCard,
  Crown,
  HelpCircle,
  Lock,
  LogOut,
  Moon,
  Palette,
  Pencil,
  Plus,
  Settings,
  Sun,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ProBadge } from '../../../components/ProBadge';
import { ProGateModal } from '../../../components/ProGateModal';
import { useProGate } from '../../../hooks/useProGate';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
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
  const { isPro, requireAccess, showPaywall, blockedFeature, dismissPaywall } = useProGate();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const user = meQuery.data?.me;

  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = bikesQuery.data?.myMotorcycles ?? [];

  const handleAddBike = () => {
    if (!requireAccess('MAX_BIKES', motorcycles.length)) return;
    haptic();
    router.push('/(garage)/add-bike');
  };

  const handleLogout = async () => {
    haptic();
    await supabase.auth.signOut();
  };

  const handleThemeChange = (value: 'system' | 'light' | 'dark') => {
    haptic();
    setStoredScheme(value);
    setColorScheme(value === 'system' ? undefined : value);
  };

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

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
            {isPro && <ProBadge />}
          </View>

          {/* Edit Profile button */}
          <Pressable
            onPress={() => {
              haptic();
              router.push('/(profile)/settings');
            }}
            style={{
              marginTop: 14,
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 20,
              borderCurve: 'continuous',
              borderWidth: 1.5,
              borderColor: isDark ? palette.primary600 : palette.primary500,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Pencil
              size={14}
              color={isDark ? palette.primary400 : palette.primary600}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: isDark ? palette.primary400 : palette.primary600,
              }}
            >
              {t('profile.editProfile', { defaultValue: 'Edit Profile' })}
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* My Bikes */}
      <Animated.View entering={FadeInUp.delay(80).duration(400)}>
        <SectionHeader label={t('profile.myBikes', { defaultValue: 'My Bikes' })} />
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {motorcycles.length === 0 ? (
            <Pressable
              onPress={() => {
                haptic();
                router.push('/(garage)/add-bike');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? `${palette.primary500}25` : palette.primary50,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={20} color={palette.primary500} strokeWidth={2} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: '600',
                  color: palette.primary500,
                }}
              >
                {t('profile.addFirstBike', { defaultValue: 'Add Your First Bike' })}
              </Text>
              <ChevronRight size={17} color={palette.neutral400} strokeWidth={2} />
            </Pressable>
          ) : (
            <>
              {motorcycles.map((bike, index) => (
                <Pressable
                  key={bike.id}
                  onPress={() => {
                    haptic();
                    router.push(`/(garage)/bike/${bike.id}`);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: pressed
                      ? isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.03)'
                      : 'transparent',
                    borderBottomWidth: index < motorcycles.length - 1 ? 0.5 : 0,
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Bike
                      size={20}
                      color={isDark ? palette.neutral300 : palette.neutral600}
                      strokeWidth={1.8}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: isDark ? palette.neutral50 : palette.neutral950,
                      }}
                      numberOfLines={1}
                    >
                      {bike.make} {bike.model}
                    </Text>
                    <Text style={{ fontSize: 13, color: palette.neutral500, marginTop: 1 }}>
                      {bike.year}
                      {bike.nickname ? ` · "${bike.nickname}"` : ''}
                    </Text>
                  </View>
                  {bike.isPrimary && (
                    <View
                      style={{
                        backgroundColor: `${palette.warning500}25`,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderCurve: 'continuous',
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: palette.warning500,
                        }}
                      >
                        {t('profile.primaryBike', { defaultValue: 'Primary' })}
                      </Text>
                    </View>
                  )}
                  <ChevronRight size={17} color={palette.neutral400} strokeWidth={2} />
                </Pressable>
              ))}
              <Pressable
                onPress={handleAddBike}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  gap: 6,
                  borderTopWidth: 0.5,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  backgroundColor: pressed
                    ? isDark
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(0,0,0,0.03)'
                    : 'transparent',
                })}
              >
                {!isPro && motorcycles.length >= FREE_TIER_LIMITS.MAX_BIKES ? (
                  <Crown size={15} color={palette.signature500} strokeWidth={2.5} />
                ) : (
                  <Plus size={15} color={palette.primary500} strokeWidth={2.5} />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.primary500 }}>
                  {t('profile.addAnotherBike', { defaultValue: 'Add Another Bike' })}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>

      {/* Pro Banner — show upgrade CTA for free users, active status for pro users */}
      {isPro ? (
        <Animated.View entering={FadeInUp.delay(160).duration(400)}>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 20,
              flexDirection: 'row',
              alignItems: 'center',
              boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: `${palette.signature500}25`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Crown
                size={22}
                color={palette.signature500}
                strokeWidth={2}
                fill={palette.signature500}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  fontSize: 17,
                  fontWeight: '700',
                }}
              >
                {t('profile.proActive', { defaultValue: 'Pro Active' })}
              </Text>
              <Text style={{ color: palette.neutral500, fontSize: 13, marginTop: 2 }}>
                {t('profile.proActiveDesc', {
                  defaultValue: 'All premium features unlocked',
                })}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(160).duration(400)}>
          <Pressable
            onPress={() => {
              haptic();
              router.push('/(tabs)/(profile)/upgrade');
            }}
            style={{ borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}
          >
            <View
              style={{
                backgroundColor: palette.primary700,
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
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Settings */}
      <Animated.View entering={FadeInUp.delay(240).duration(400)}>
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
          <SettingsRow
            icon={Settings}
            label={t('profile.settings')}
            isDark={isDark}
            onPress={() => router.push('/(profile)/settings')}
          />
          <SettingsRow
            icon={Bell}
            label={t('profile.notifications', { defaultValue: 'Notifications' })}
            isDark={isDark}
            onPress={() => router.push('/(profile)/notifications')}
          />
          <SettingsRow
            icon={Lock}
            label={t('profile.privacy')}
            isDark={isDark}
            onPress={() => router.push('/(profile)/privacy')}
          />
          <SettingsRow
            icon={CreditCard}
            label={t('profile.subscriptions')}
            isDark={isDark}
            onPress={() => router.push('/(tabs)/(profile)/upgrade')}
          />
          <SettingsRow
            icon={HelpCircle}
            label={t('profile.support')}
            isDark={isDark}
            onPress={() => router.push('/(profile)/support')}
            isLast
          />
        </View>
      </Animated.View>

      {/* Language */}
      <Animated.View entering={FadeInUp.delay(320).duration(400)}>
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
      <Animated.View entering={FadeInUp.delay(400).duration(400)}>
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
      <Animated.View entering={FadeInUp.delay(480).duration(400)}>
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

      <ProGateModal visible={showPaywall} feature={blockedFeature} onDismiss={dismissPaywall} />
    </ScrollView>
  );
}
