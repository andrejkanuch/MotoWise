import { CURRENCY_SYMBOLS, type Currency, type MeasurementSystem } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { getLocales } from 'expo-localization';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { CURRENCY_LIST } from '../../lib/currencies';
import { useOnboardingStore } from '../../stores/onboarding.store';

function detectMeasurementSystem(): MeasurementSystem {
  const locale = getLocales()[0];
  return locale?.measurementSystem === 'us' ? 'imperial' : 'metric';
}

function detectCurrency(): Currency {
  const code = getLocales()[0]?.currencyCode;
  if (code && code in CURRENCY_SYMBOLS) return code as Currency;
  return 'USD';
}

export default function PreferencesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const setMeasurementSystem = useOnboardingStore((s) => s.setMeasurementSystem);
  const setCurrency = useOnboardingStore((s) => s.setCurrency);

  const [units, setUnits] = useState<MeasurementSystem>(detectMeasurementSystem);
  const [currency, setSelectedCurrency] = useState<Currency>(detectCurrency);
  const [search, setSearch] = useState('');

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return CURRENCY_LIST;
    const q = search.toLowerCase();
    return CURRENCY_LIST.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.includes(q),
    );
  }, [search]);

  const previewText =
    units === 'metric'
      ? 'Next service in 1,240 km \u00B7 18 \u00B0C'
      : 'Next service in 770 mi \u00B7 64 \u00B0F';

  const selectedCurrencyItem = CURRENCY_LIST.find((c) => c.code === currency);

  const handleToggleUnits = (system: MeasurementSystem) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setUnits(system);
  };

  const handleSelectCurrency = (code: Currency) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCurrency(code);
  };

  const handleContinue = () => {
    setMeasurementSystem(units);
    setCurrency(currency);
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'preferences',
      step_index: 4,
      measurement_system: units,
      currency,
    });
    router.replace('/(onboarding)/goals');
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={4} totalScreens={TOTAL_SCREENS} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Animated.View entering={FadeIn.duration(200)}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 40,
                lineHeight: 44,
                color: ONBOARDING_COLORS.textPrimary,
                letterSpacing: -0.8,
                marginBottom: 8,
              }}
            >
              How do you{'\n'}
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Italic',
                  color: ONBOARDING_COLORS.warm2,
                }}
              >
                measure up?
              </Text>
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(100).duration(300)}
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: ONBOARDING_COLORS.textSecondary,
              marginBottom: 32,
            }}
          >
            {t('onboarding.preferencesSubtitle')}
          </Animated.Text>

          {/* UNITS section */}
          <Animated.View entering={FadeInUp.delay(150).duration(300)}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: ONBOARDING_COLORS.textMuted,
                marginBottom: 12,
              }}
            >
              UNITS
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {/* Metric button */}
              <Pressable
                onPress={() => handleToggleUnits('metric')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor:
                    units === 'metric' ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.cardBg,
                  borderWidth: 1,
                  borderColor:
                    units === 'metric'
                      ? ONBOARDING_COLORS.warm
                      : ONBOARDING_COLORS.cardBorderDefault,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: units === 'metric' ? '#1a1208' : ONBOARDING_COLORS.textPrimary,
                    marginBottom: 2,
                  }}
                >
                  Metric
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: units === 'metric' ? '#1a120899' : ONBOARDING_COLORS.textMuted,
                  }}
                >
                  km · L · °C
                </Text>
              </Pressable>

              {/* Imperial button */}
              <Pressable
                onPress={() => handleToggleUnits('imperial')}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor:
                    units === 'imperial' ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.cardBg,
                  borderWidth: 1,
                  borderColor:
                    units === 'imperial'
                      ? ONBOARDING_COLORS.warm
                      : ONBOARDING_COLORS.cardBorderDefault,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  alignItems: 'center',
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: units === 'imperial' ? '#1a1208' : ONBOARDING_COLORS.textPrimary,
                    marginBottom: 2,
                  }}
                >
                  Imperial
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: units === 'imperial' ? '#1a120899' : ONBOARDING_COLORS.textMuted,
                  }}
                >
                  mi · gal · °F
                </Text>
              </Pressable>
            </View>

            {/* Live preview */}
            <Animated.View entering={FadeIn.duration(200)}>
              <Text
                style={{
                  fontSize: 14,
                  color: ONBOARDING_COLORS.warm2,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  marginBottom: 32,
                }}
              >
                {previewText}
              </Text>
            </Animated.View>
          </Animated.View>

          {/* CURRENCY section */}
          <Animated.View entering={FadeInUp.delay(200).duration(300)}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: ONBOARDING_COLORS.textMuted,
                marginBottom: 12,
              }}
            >
              CURRENCY
            </Text>

            {/* Selected currency badge */}
            {selectedCurrencyItem && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: ONBOARDING_COLORS.warm,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1208' }}>
                  {selectedCurrencyItem.symbol}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1208' }}>
                  {selectedCurrencyItem.code}
                </Text>
              </View>
            )}

            {/* Search input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: ONBOARDING_COLORS.cardBg,
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.cardBorder,
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                marginBottom: 12,
              }}
            >
              <Search size={16} color={ONBOARDING_COLORS.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search currencies..."
                placeholderTextColor={ONBOARDING_COLORS.textDimmed}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  fontSize: 15,
                  color: ONBOARDING_COLORS.textPrimary,
                }}
              />
            </View>

            {/* Currency list */}
            <View
              style={{
                backgroundColor: ONBOARDING_COLORS.cardBg,
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.cardBorder,
                borderRadius: 16,
                borderCurve: 'continuous',
                overflow: 'hidden',
                maxHeight: 260,
              }}
            >
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredCurrencies.map((item, index) => {
                  const isSelected = item.code === currency;
                  return (
                    <Pressable
                      key={item.code}
                      onPress={() => handleSelectCurrency(item.code)}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 13,
                        paddingHorizontal: 16,
                        backgroundColor: isSelected
                          ? ONBOARDING_COLORS.cardBgSelected
                          : 'transparent',
                        opacity: pressed ? 0.7 : 1,
                        borderTopWidth: index > 0 ? 1 : 0,
                        borderTopColor: ONBOARDING_COLORS.line,
                      })}
                    >
                      <Text
                        style={{
                          width: 32,
                          fontSize: 17,
                          fontWeight: '600',
                          color: ONBOARDING_COLORS.warm,
                        }}
                      >
                        {item.symbol}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '600',
                          color: ONBOARDING_COLORS.textPrimary,
                          marginRight: 8,
                        }}
                      >
                        {item.code}
                      </Text>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: ONBOARDING_COLORS.textSecondary,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {isSelected && <Check size={18} color={ONBOARDING_COLORS.warm} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        </ScrollView>

        {/* CTA */}
        <Animated.View
          entering={FadeIn.delay(300).duration(300)}
          style={{ paddingHorizontal: 24, paddingBottom: 48 }}
        >
          <OnboardingContinueButton label={t('onboarding.continue')} onPress={handleContinue} />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
