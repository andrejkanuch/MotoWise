import { palette } from '@motovault/design-system';
import {
  DeleteAccountDocument,
  MeDocument,
  MyMotorcyclesDocument,
  UpdateUserDocument,
} from '@motovault/graphql';
import type { Currency, SupportedLocale } from '@motovault/types';
import {
  CURRENCY_SYMBOLS,
  FREE_TIER_LIMITS,
  REVENUECAT_ENTITLEMENT_PRO,
  SUPPORTED_LOCALES,
} from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Bell,
  Bike,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Crown,
  Flame,
  Globe,
  HelpCircle,
  Lock,
  LogOut,
  Map as MapRoute,
  Megaphone,
  Moon,
  Navigation,
  Palette,
  Pencil,
  Plus,
  Ruler,
  Settings,
  Sun,
  Trash2,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { PostHogMaskView } from 'posthog-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ProBadge } from '../../../components/pro-badge';
import { useProGate } from '../../../hooks/use-pro-gate';
import { gqlFetcher } from '../../../lib/graphql-client';
import { isAccountAlreadyDeleted, userFriendlyError } from '../../../lib/graphql-errors';
import { queryKeys } from '../../../lib/query-keys';
import { presentPaywall } from '../../../lib/subscription';
import { safeSignOut } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/auth.store';
import { tint, useEditorialTheme } from '../../../theme/editorial';

const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  'pt-BR': 'Português (BR)',
  ja: '日本語',
  hi: 'हिन्दी',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  pl: 'Polski',
  sk: 'Slovenčina',
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
  const { t: theme } = useEditorialTheme();
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: theme.ink2,
        textTransform: 'uppercase',
        letterSpacing: 2.2,
        marginBottom: 10,
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
  color,
}: {
  icon: typeof Settings;
  label: string;
  onPress?: () => void;
  isLast?: boolean;
  color?: string;
}) {
  const { t: theme } = useEditorialTheme();
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
        backgroundColor: pressed ? tint(theme.ink, 0.05) : 'transparent',
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: theme.line,
      })}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          borderCurve: 'continuous',
          backgroundColor: theme.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={17} color={color ?? theme.ink3} strokeWidth={1.8} />
      </View>
      <Text style={{ flex: 1, fontSize: 16, color: color ?? theme.ink, marginLeft: 12 }}>
        {label}
      </Text>
      {!color && <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />}
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
    measurementSystem,
    setMeasurementSystem,
    currency,
    setCurrency,
  } = useAuthStore();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { t: theme } = useEditorialTheme();
  const isDark = colorScheme === 'dark';
  const { isPro } = useProGate();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

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

  const handleAddBike = async () => {
    if (!isPro && motorcycles.length >= FREE_TIER_LIMITS.MAX_BIKES) {
      haptic();
      const result = await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        source: 'profile',
        feature: 'unlimited_bikes',
        surface: 'profile_add_bike',
      });
      if (result !== 'purchased' && result !== 'restored') return;
    }
    haptic();
    router.navigate('/(tabs)/(garage)');
  };

  const handleLogout = async () => {
    haptic();
    await safeSignOut();
    router.replace('/(auth)/login');
  };

  const queryClient = useQueryClient();

  const updatePreferenceMutation = useMutation({
    mutationFn: (input: { currency?: string; measurementSystem?: string }) =>
      gqlFetcher(UpdateUserDocument, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
    },
  });

  const finishAccountDeletion = async () => {
    await safeSignOut();
    queryClient.clear();
    router.replace('/(auth)/login');
  };

  const deleteMutation = useMutation({
    mutationFn: () => gqlFetcher(DeleteAccountDocument),
    meta: { skipSentryCapture: isAccountAlreadyDeleted },
    onSuccess: finishAccountDeletion,
    onError: (error: Error) => {
      // Account already gone server-side (e.g. a retried deletion) — the desired
      // end state is identical to success, so finish the local sign-out.
      if (isAccountAlreadyDeleted(error)) {
        void finishAccountDeletion();
        return;
      }
      Alert.alert(
        t('privacy.deleteErrorTitle', { defaultValue: 'Deletion Failed' }),
        userFriendlyError(error),
      );
    },
  });

  const handleDeleteAccount = () => {
    haptic();
    Alert.alert(
      t('privacy.deleteTitle', { defaultValue: 'Delete Account' }),
      t('privacy.deleteWarning', {
        defaultValue:
          'This will permanently delete your account and ALL associated data including motorcycles, maintenance history, diagnostics, and learning progress. Your subscription will be cancelled. You have 30 days to change your mind before data is permanently removed.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privacy.deleteConfirmButton', { defaultValue: 'Delete My Account' }),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('privacy.deleteConfirmTitle', { defaultValue: 'Are you absolutely sure?' }),
              t('privacy.deleteConfirmMessage', {
                defaultValue:
                  'This cannot be undone. Type DELETE to confirm is not required, but please be certain.',
              }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('privacy.deleteFinal', { defaultValue: 'Yes, Delete Everything' }),
                  style: 'destructive',
                  onPress: () => deleteMutation.mutate(),
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleThemeChange = (value: 'system' | 'light' | 'dark') => {
    haptic();
    setStoredScheme(value);
    setColorScheme(value === 'system' ? 'unspecified' : value);
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
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Editorial heading */}
      <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 40,
            color: theme.ink,
            letterSpacing: -0.8,
            lineHeight: 40,
          }}
        >
          {t('profile.title')}
        </Text>
      </View>

      {/* User Card */}
      <Animated.View entering={FadeInUp.duration(400)}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          {/* Mask the rider's identity (name, @username, initials) from session
              replay — read-only `<Text>` is not covered by `maskAllTextInputs`.
              (todo 186) */}
          <PostHogMaskView style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                borderCurve: 'continuous',
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={[theme.warm, theme.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '600', color: '#fff' }}>{initials}</Text>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  selectable
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: theme.ink,
                    letterSpacing: -0.1,
                  }}
                >
                  {user?.fullName ?? t('profile.rider')}
                </Text>
                {isPro && <ProBadge />}
              </View>

              {/* Public profile info */}
              {user?.publicUsername && (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.ink2,
                    marginTop: 2,
                  }}
                >
                  @{user.publicUsername}
                </Text>
              )}
            </View>
          </PostHogMaskView>

          {/* Action buttons row */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {/* Edit Public Profile */}
            <Pressable
              onPress={() => {
                haptic();
                router.push('/(profile)/edit-profile');
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                borderCurve: 'continuous',
                borderWidth: 1.5,
                borderColor: theme.warm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Pencil size={14} color={theme.warm} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.warm,
                }}
              >
                {t('community.editProfile')}
              </Text>
            </Pressable>

            {/* Settings */}
            <Pressable
              onPress={() => {
                haptic();
                router.push('/(profile)/settings');
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                borderCurve: 'continuous',
                borderWidth: 1.5,
                borderColor: theme.ink3,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Settings size={14} color={theme.ink3} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.ink3,
                }}
              >
                {t('settings.title', { defaultValue: 'Settings' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Follower / Following stats (only if public profile) */}
      {user?.isPublic && (
        <Animated.View entering={FadeInUp.delay(60).duration(400)}>
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => router.push('/(profile)/rider/followers')}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                alignItems: 'center',
                boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: theme.ink,
                }}
              >
                {user.followerCount ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.ink3,
                  marginTop: 2,
                }}
              >
                {t('community.followers')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(profile)/rider/followers')}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                alignItems: 'center',
                boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: theme.ink,
                }}
              >
                {user.followingCount ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.ink3,
                  marginTop: 2,
                }}
              >
                {t('community.following')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* My Bikes */}
      <Animated.View entering={FadeInUp.delay(80).duration(400)}>
        <SectionHeader label={t('profile.myBikes', { defaultValue: 'My Bikes' })} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          {motorcycles.length === 0 ? (
            <Pressable
              onPress={() => {
                haptic();
                router.navigate('/(tabs)/(garage)');
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
                  backgroundColor: tint(theme.warm, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={20} color={theme.warm} strokeWidth={2} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: '600',
                  color: theme.warm,
                }}
              >
                {t('profile.addFirstBike', { defaultValue: 'Add Your First Bike' })}
              </Text>
              <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
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
                    backgroundColor: pressed ? tint(theme.ink, 0.05) : 'transparent',
                    borderBottomWidth: index < motorcycles.length - 1 ? 0.5 : 0,
                    borderBottomColor: theme.line,
                  })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: theme.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Bike size={20} color={theme.ink3} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: theme.ink,
                      }}
                      numberOfLines={1}
                    >
                      {bike.make} {bike.model}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.ink3, marginTop: 1 }}>
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
                  <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
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
                  borderTopColor: theme.line,
                  backgroundColor: pressed ? tint(theme.ink, 0.05) : 'transparent',
                })}
              >
                {!isPro && motorcycles.length >= FREE_TIER_LIMITS.MAX_BIKES ? (
                  <Crown size={15} color={theme.purple} strokeWidth={2.5} />
                ) : (
                  <Plus size={15} color={theme.warm} strokeWidth={2.5} />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
                  {t('profile.addAnotherBike', { defaultValue: 'Add Another Bike' })}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>

      {/* My Rides */}
      <Animated.View entering={FadeInUp.delay(120).duration(400)}>
        <Pressable
          onPress={() => {
            haptic();
            // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
            router.push('/(tabs)/(profile)/rides' as any);
          }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: tint(palette.accent500, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Navigation size={22} color={palette.accent500} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.ink,
                fontSize: 17,
                fontWeight: '700',
              }}
            >
              {t('profile.myRidesTitle', { defaultValue: 'My Rides' })}
            </Text>
            <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
              {t('profile.myRidesDescription', {
                defaultValue: 'Ride history, stats & route maps',
              })}
            </Text>
          </View>
          <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* Roads I've ridden — lifetime heatmap + annual recap */}
      <Animated.View entering={FadeInUp.delay(125).duration(400)}>
        <Pressable
          onPress={() => {
            haptic();
            // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
            router.push('/(tabs)/(profile)/heatmap' as any);
          }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.danger, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Flame size={22} color={theme.danger} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.ink,
                fontSize: 17,
                fontWeight: '700',
              }}
            >
              {t('profile.roadsTitle')}
            </Text>
            <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
              {t('profile.roadsSubtitle')}
            </Text>
          </View>
          <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* My Trips */}
      <Animated.View entering={FadeInUp.delay(130).duration(400)}>
        <Pressable
          onPress={() => {
            haptic();
            router.push('/(profile)/trips');
          }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: tint(palette.warning500, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <MapRoute size={22} color={palette.warning500} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.ink,
                fontSize: 17,
                fontWeight: '700',
              }}
            >
              {t('profile.myTripsTitle', { defaultValue: 'My Trips' })}
            </Text>
            <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
              {t('profile.myTripsDescription', {
                defaultValue: 'Drafts & published multi-day plans',
              })}
            </Text>
          </View>
          <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* Saved Routes */}
      <Animated.View entering={FadeInUp.delay(140).duration(400)}>
        <Pressable
          onPress={() => {
            haptic();
            // biome-ignore lint/suspicious/noExplicitAny: expo-router typed route
            router.push('/(tabs)/(profile)/saved' as any);
          }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.purple, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <Bookmark size={22} color={theme.purple} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.ink,
                fontSize: 17,
                fontWeight: '700',
              }}
            >
              {t('profile.savedRoutesTitle')}
            </Text>
            <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
              {t('profile.savedRoutesSubtitle')}
            </Text>
          </View>
          <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* Learn */}
      <Animated.View entering={FadeInUp.delay(160).duration(400)}>
        <Pressable
          onPress={() => {
            haptic();
            router.push('/(tabs)/(learn)');
          }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.warm, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
            }}
          >
            <BookOpen size={22} color={theme.warm} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.ink,
                fontSize: 17,
                fontWeight: '700',
              }}
            >
              {t('tabs.learn')}
            </Text>
            <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
              {t('learn.profileDescription', {
                defaultValue: 'Articles, quizzes & motorcycle knowledge',
              })}
            </Text>
          </View>
          <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
        </Pressable>
      </Animated.View>

      {/* Pro Banner — show upgrade CTA for free users, active status for pro users */}
      {isPro ? (
        <Animated.View entering={FadeInUp.delay(240).duration(400)}>
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 20,
              borderCurve: 'continuous',
              padding: 20,
              flexDirection: 'row',
              alignItems: 'center',
              boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: `${theme.purple}25`,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
              }}
            >
              <Crown size={22} color={theme.purple} strokeWidth={2} fill={theme.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.ink,
                  fontSize: 17,
                  fontWeight: '700',
                }}
              >
                {t('profile.proActive', { defaultValue: 'Pro Active' })}
              </Text>
              <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>
                {t('profile.proActiveDesc', {
                  defaultValue: 'All premium features unlocked',
                })}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <Pressable
            onPress={() => {
              haptic();
              presentPaywall({
                source: 'profile',
                feature: 'subscription',
                surface: 'profile_pro_banner',
              });
            }}
            style={{ borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}
          >
            <View
              style={{
                backgroundColor: theme.warm,
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
      <Animated.View entering={FadeInUp.delay(280).duration(400)}>
        <SectionHeader label={t('profile.settings')} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <SettingsRow
            icon={Settings}
            label={t('profile.settings')}
            onPress={() => router.push('/(profile)/settings')}
          />
          <SettingsRow
            icon={Bell}
            label={t('profile.notifications', { defaultValue: 'Notifications' })}
            onPress={() => router.push('/(profile)/notifications')}
          />
          <SettingsRow
            icon={Lock}
            label={t('profile.privacy')}
            onPress={() => router.push('/(profile)/privacy')}
          />
          <SettingsRow
            icon={CreditCard}
            label={t('profile.subscriptions')}
            onPress={() =>
              presentPaywall({
                source: 'profile',
                feature: 'subscription',
                surface: 'profile_subscriptions_row',
              })
            }
          />
          <SettingsRow
            icon={Megaphone}
            label={t('whatsNew.badge')}
            onPress={() => router.push('/(modals)/whats-new' as never)}
          />
          <SettingsRow
            icon={HelpCircle}
            label={t('profile.support')}
            onPress={() => router.push('/(profile)/support')}
            isLast
          />
        </View>
      </Animated.View>

      {/* Language */}
      <Animated.View entering={FadeInUp.delay(360).duration(400)}>
        <SectionHeader label={t('profile.language')} />
        <Pressable
          onPress={() => {
            haptic();
            setShowLangPicker(true);
          }}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14,
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <Globe size={20} color={theme.ink3} strokeWidth={1.8} />
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              fontWeight: '500',
              color: theme.ink,
              marginLeft: 12,
            }}
          >
            {LOCALE_DISPLAY_NAMES[locale]}
          </Text>
          <ChevronDown size={18} color={theme.ink3} strokeWidth={2} />
        </Pressable>

        <Modal
          visible={showLangPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowLangPicker(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
            onPress={() => setShowLangPicker(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.bg,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderCurve: 'continuous',
                paddingBottom: 40,
                maxHeight: '70%',
              }}
            >
              {/* Handle bar */}
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: theme.line,
                  }}
                />
              </View>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.ink,
                  paddingHorizontal: 20,
                  paddingBottom: 12,
                }}
              >
                {t('profile.language')}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                {SUPPORTED_LOCALES.map((loc) => {
                  const selected = locale === loc;
                  return (
                    <Pressable
                      key={loc}
                      onPress={() => {
                        haptic();
                        setLocale(loc);
                        setShowLangPicker(false);
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        backgroundColor: pressed ? theme.surface2 : 'transparent',
                      })}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 16,
                          fontWeight: selected ? '600' : '400',
                          color: selected ? theme.warm : theme.ink,
                        }}
                      >
                        {LOCALE_DISPLAY_NAMES[loc]}
                      </Text>
                      {selected && <Check size={20} color={theme.warm} strokeWidth={2.5} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </Animated.View>

      {/* Theme */}
      <Animated.View entering={FadeInUp.delay(440).duration(400)}>
        <SectionHeader label={t('profile.theme')} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            padding: 4,
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
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
                  backgroundColor: selected ? theme.warm : 'transparent',
                }}
              >
                <ThemeIcon
                  size={15}
                  color={selected ? palette.white : theme.ink3}
                  strokeWidth={2}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: selected ? palette.white : theme.ink3,
                  }}
                >
                  {t(THEME_LABEL_KEYS[value])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Units */}
      <Animated.View entering={FadeInUp.delay(520).duration(400)}>
        <SectionHeader label={t('profile.units', { defaultValue: 'Units' })} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            padding: 4,
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          {(['metric', 'imperial'] as const).map((value) => {
            const selected = measurementSystem === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  haptic();
                  setMeasurementSystem(value);
                  updatePreferenceMutation.mutate({ measurementSystem: value });
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: selected ? theme.warm : 'transparent',
                }}
              >
                <Ruler size={15} color={selected ? palette.white : theme.ink3} strokeWidth={2} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: selected ? palette.white : theme.ink3,
                  }}
                >
                  {value === 'metric'
                    ? t('profile.metric', { defaultValue: 'Metric (km, °C)' })
                    : t('profile.imperial', { defaultValue: 'Imperial (mi, °F)' })}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      {/* Currency */}
      <Animated.View entering={FadeInUp.delay(540).duration(400)}>
        <SectionHeader label={t('profile.currency', { defaultValue: 'Currency' })} />
        <Pressable
          onPress={() => setShowCurrencyPicker(true)}
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: '700',
              width: 36,
              color: theme.ink,
            }}
          >
            {CURRENCY_SYMBOLS[currency as Currency] ?? '$'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: theme.ink,
              }}
            >
              {currency}
            </Text>
          </View>
          <ChevronDown size={18} color={theme.ink3} />
        </Pressable>

        <Modal
          visible={showCurrencyPicker}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setShowCurrencyPicker(false)}
        >
          <View style={{ flex: 1, backgroundColor: theme.bg }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderColor: theme.line,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.ink,
                }}
              >
                {t('profile.selectCurrency', { defaultValue: 'Select Currency' })}
              </Text>
              <Pressable onPress={() => setShowCurrencyPicker(false)}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.warm }}>
                  {t('common.done', { defaultValue: 'Done' })}
                </Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
              {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => {
                const isSelected = currency === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => {
                      haptic();
                      setCurrency(code as Currency);
                      updatePreferenceMutation.mutate({ currency: code });
                      setShowCurrencyPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: isSelected ? tint(theme.warm, 0.12) : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '700',
                        width: 42,
                        color: theme.ink,
                      }}
                    >
                      {symbol}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: '500',
                        color: theme.ink2,
                      }}
                    >
                      {code}
                    </Text>
                    {isSelected && <Check size={18} color={theme.warm} strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </Animated.View>

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
          <SettingsRow
            icon={LogOut}
            label={t('auth.signOut')}
            onPress={handleLogout}
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
          <SettingsRow
            icon={Trash2}
            label={t('privacy.deleteAccount', { defaultValue: 'Delete Account' })}
            onPress={handleDeleteAccount}
            color={theme.danger}
            isLast
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
}
