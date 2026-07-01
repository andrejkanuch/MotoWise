import { palette } from '@motovault/design-system';
import type { Currency, SupportedLocale } from '@motovault/types';
import { CURRENCY_SYMBOLS, SUPPORTED_LOCALES } from '@motovault/types';
import type { UseMutationResult } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Bell,
  Check,
  ChevronDown,
  CreditCard,
  Globe,
  HelpCircle,
  Lock,
  Megaphone,
  Moon,
  Palette,
  Ruler,
  Settings,
  Smartphone,
  Sun,
} from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { presentPaywall } from '../../lib/subscription';
import { useAuthStore } from '../../stores/auth.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact } from '../../utils/haptics';
import { ESettingsRow, ESettingsSectionLabel } from '../ui/editorial';

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

export function PreferencesSection({
  isDark,
  updatePreferenceMutation,
}: {
  isDark: boolean;
  updatePreferenceMutation: UseMutationResult<
    unknown,
    Error,
    { currency?: string; measurementSystem?: string }
  >;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
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
  const { setColorScheme } = useColorScheme();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const handleThemeChange = (value: 'system' | 'light' | 'dark') => {
    triggerImpact();
    setStoredScheme(value);
    setColorScheme(value === 'system' ? 'unspecified' : value);
  };

  return (
    <>
      {/* Settings */}
      <Animated.View entering={FadeInUp.delay(280).duration(400)}>
        <ESettingsSectionLabel label={t('profile.settings')} />
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
            icon={Settings}
            label={t('profile.settings')}
            onPress={() => router.push('/(profile)/settings')}
          />
          <ESettingsRow
            icon={Bell}
            label={t('profile.notifications', { defaultValue: 'Notifications' })}
            onPress={() => router.push('/(profile)/notifications')}
          />
          <ESettingsRow
            icon={Lock}
            label={t('profile.privacy')}
            onPress={() => router.push('/(profile)/privacy')}
          />
          <ESettingsRow
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
          <ESettingsRow
            icon={Megaphone}
            label={t('whatsNew.badge')}
            onPress={() => router.push('/(modals)/whats-new')}
          />
          <ESettingsRow
            icon={Smartphone}
            label={t('carplay.entryLabel', { defaultValue: 'CarPlay Companion' })}
            onPress={() => router.push('/(modals)/carplay')}
          />
          <ESettingsRow
            icon={HelpCircle}
            label={t('profile.support')}
            onPress={() => router.push('/(profile)/support')}
            isLast
          />
        </View>
      </Animated.View>

      {/* Language */}
      <Animated.View entering={FadeInUp.delay(360).duration(400)}>
        <ESettingsSectionLabel label={t('profile.language')} />
        <Pressable
          onPress={() => {
            triggerImpact();
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
            style={{
              flex: 1,
              backgroundColor: tint(palette.neutral950, 0.4),
              justifyContent: 'flex-end',
            }}
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
                        triggerImpact();
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
        <ESettingsSectionLabel label={t('profile.theme')} />
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
        <ESettingsSectionLabel label={t('profile.units', { defaultValue: 'Units' })} />
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
                  triggerImpact();
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
        <ESettingsSectionLabel label={t('profile.currency', { defaultValue: 'Currency' })} />
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
                      triggerImpact();
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
    </>
  );
}
