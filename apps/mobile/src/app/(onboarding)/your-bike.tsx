import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronLeft, Minus, Plus, Search, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { useMotorcycleMakes } from '../../hooks/use-motorcycle-makes';
import { useMotorcycleModels } from '../../hooks/use-motorcycle-models';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const SCREEN_INDEX = 2;
const MIN_YEAR = 1900;
const MAX_YEAR = 2030;
const DEFAULT_YEAR = 2023;
const MAX_DROPDOWN_ITEMS = 8;

export default function YourBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);

  const [year, setYear] = useState(DEFAULT_YEAR);
  const [yearText, setYearText] = useState(String(DEFAULT_YEAR));

  const [makeSearch, setMakeSearch] = useState('');
  const [selectedMake, setSelectedMake] = useState<{ id: number; name: string } | null>(null);

  const [modelSearch, setModelSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { filteredMakes, popularMakes } = useMotorcycleMakes(makeSearch);
  const { filteredModels } = useMotorcycleModels(selectedMake?.id ?? 0, year, modelSearch);

  const displayMakes = useMemo(() => {
    if (makeSearch.length === 0) return popularMakes.slice(0, MAX_DROPDOWN_ITEMS);
    return filteredMakes.slice(0, MAX_DROPDOWN_ITEMS);
  }, [makeSearch, filteredMakes, popularMakes]);

  const displayModels = useMemo(() => {
    return filteredModels.slice(0, MAX_DROPDOWN_ITEMS);
  }, [filteredModels]);

  const showMakeDropdown = makeSearch.length > 0 && !selectedMake;
  const showModelDropdown = modelSearch.length > 0 && !selectedModel && selectedMake;
  const noMakeResults = showMakeDropdown && displayMakes.length === 0 && makeSearch.length > 1;
  const noModelResults = showModelDropdown && displayModels.length === 0 && modelSearch.length > 1;

  const handleYearChange = useCallback(
    (delta: number) => {
      const next = Math.max(MIN_YEAR, Math.min(MAX_YEAR, year + delta));
      setYear(next);
      setYearText(String(next));
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      // Reset model when year changes
      setSelectedModel(null);
      setModelSearch('');
    },
    [year],
  );

  const handleYearTextChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setYearText(cleaned);
    const num = Number.parseInt(cleaned, 10);
    if (!Number.isNaN(num) && num >= MIN_YEAR && num <= MAX_YEAR) {
      setYear(num);
      setSelectedModel(null);
      setModelSearch('');
    }
  }, []);

  const handleYearBlur = useCallback(() => {
    setYearText(String(year));
  }, [year]);

  const handleSelectMake = useCallback((makeId: number, makeName: string) => {
    setSelectedMake({ id: makeId, name: makeName });
    setMakeSearch('');
    setSelectedModel(null);
    setModelSearch('');
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleFreetypeMake = useCallback(() => {
    setSelectedMake({ id: 0, name: makeSearch.trim() });
    setMakeSearch('');
    setSelectedModel(null);
    setModelSearch('');
  }, [makeSearch]);

  const handleClearMake = useCallback(() => {
    setSelectedMake(null);
    setMakeSearch('');
    setSelectedModel(null);
    setModelSearch('');
  }, []);

  const handleSelectModel = useCallback((modelName: string) => {
    setSelectedModel(modelName);
    setModelSearch('');
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleFreetypeModel = useCallback(() => {
    setSelectedModel(modelSearch.trim());
    setModelSearch('');
  }, [modelSearch]);

  const handleClearModel = useCallback(() => {
    setSelectedModel(null);
    setModelSearch('');
  }, []);

  const handleContinue = useCallback(() => {
    setBikeData({
      year,
      make: selectedMake?.name ?? '',
      makeId: selectedMake?.id ?? 0,
      model: selectedModel ?? '',
    });
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'your_bike',
      year,
      make: selectedMake?.name ?? '',
      model: selectedModel ?? '',
    });
    router.replace('/(onboarding)/bike-photo');
  }, [year, selectedMake, selectedModel, setBikeData, router]);

  const handleSkip = useCallback(() => {
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, { step: 'your_bike' });
    router.replace('/(onboarding)/preferences');
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={SCREEN_INDEX} totalScreens={TOTAL_SCREENS} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <ChevronLeft size={22} color={ONBOARDING_COLORS.textSecondary} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 28,
            paddingTop: 24,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Animated.View entering={FadeIn.delay(100).duration(250)}>
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
              Tell us about{'\n'}
              <Text
                style={{
                  fontFamily: 'InstrumentSerif-Italic',
                  color: ONBOARDING_COLORS.warm2,
                }}
              >
                your ride.
              </Text>
            </Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.Text
            entering={FadeIn.delay(150).duration(250)}
            style={{
              fontSize: 15,
              lineHeight: 21,
              color: ONBOARDING_COLORS.textSecondary,
              marginBottom: 32,
            }}
          >
            {t('onboarding.yourBikeSubtitle')}
          </Animated.Text>

          {/* YEAR section */}
          <Animated.View entering={FadeInDown.delay(200).duration(250)}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.5,
                color: ONBOARDING_COLORS.textSecondary,
                marginBottom: 10,
              }}
            >
              YEAR
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: ONBOARDING_COLORS.cardBg,
                borderRadius: 16,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.cardBorderDefault,
                overflow: 'hidden',
              }}
            >
              <Pressable
                onPress={() => handleYearChange(-1)}
                style={({ pressed }) => ({
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Minus size={20} color={ONBOARDING_COLORS.textSecondary} />
              </Pressable>
              <TextInput
                value={yearText}
                onChangeText={handleYearTextChange}
                onBlur={handleYearBlur}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: '600',
                  color: ONBOARDING_COLORS.textPrimary,
                  paddingVertical: 14,
                }}
              />
              <Pressable
                onPress={() => handleYearChange(1)}
                style={({ pressed }) => ({
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Plus size={20} color={ONBOARDING_COLORS.textSecondary} />
              </Pressable>
            </View>
          </Animated.View>

          {/* MAKE section */}
          <Animated.View entering={FadeInDown.delay(250).duration(250)} style={{ marginTop: 28 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.5,
                color: ONBOARDING_COLORS.textSecondary,
                marginBottom: 10,
              }}
            >
              MAKE
            </Text>

            {selectedMake ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: ONBOARDING_COLORS.cardBgSelected,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  borderWidth: 2,
                  borderColor: ONBOARDING_COLORS.warm,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textPrimary,
                  }}
                >
                  {selectedMake.name}
                </Text>
                <Pressable onPress={handleClearMake} hitSlop={8}>
                  <X size={18} color={ONBOARDING_COLORS.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: ONBOARDING_COLORS.cardBg,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: ONBOARDING_COLORS.cardBorderDefault,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                }}
              >
                <Search size={18} color={ONBOARDING_COLORS.textMuted} />
                <TextInput
                  value={makeSearch}
                  onChangeText={setMakeSearch}
                  placeholder="Search any make..."
                  placeholderTextColor={ONBOARDING_COLORS.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: ONBOARDING_COLORS.textPrimary,
                    paddingVertical: 14,
                    paddingLeft: 10,
                  }}
                />
              </View>
            )}

            {/* Make dropdown */}
            {showMakeDropdown && displayMakes.length > 0 && (
              <View
                style={{
                  backgroundColor: ONBOARDING_COLORS.surface2,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  marginTop: 6,
                  overflow: 'hidden',
                }}
              >
                {displayMakes.map((make) => (
                  <Pressable
                    key={make.makeId}
                    onPress={() => handleSelectMake(make.makeId, make.makeName)}
                    style={({ pressed }) => ({
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      backgroundColor: pressed ? ONBOARDING_COLORS.cardBgSelected : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: ONBOARDING_COLORS.textPrimary,
                        fontWeight: '500',
                      }}
                    >
                      {make.makeName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Free-type make fallback */}
            {noMakeResults && (
              <Pressable
                onPress={handleFreetypeMake}
                style={({ pressed }) => ({
                  backgroundColor: ONBOARDING_COLORS.surface2,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  marginTop: 6,
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 15, color: ONBOARDING_COLORS.warm, fontWeight: '500' }}>
                  Use '{makeSearch.trim()}' as make
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* MODEL section */}
          <Animated.View entering={FadeInDown.delay(300).duration(250)} style={{ marginTop: 28 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1.5,
                color: ONBOARDING_COLORS.textSecondary,
                marginBottom: 10,
              }}
            >
              MODEL
            </Text>

            {selectedModel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: ONBOARDING_COLORS.cardBgSelected,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  borderWidth: 2,
                  borderColor: ONBOARDING_COLORS.warm,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textPrimary,
                  }}
                >
                  {selectedModel}
                </Text>
                <Pressable onPress={handleClearModel} hitSlop={8}>
                  <X size={18} color={ONBOARDING_COLORS.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: ONBOARDING_COLORS.cardBg,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: ONBOARDING_COLORS.cardBorderDefault,
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  opacity: selectedMake ? 1 : 0.5,
                }}
              >
                <Search size={18} color={ONBOARDING_COLORS.textMuted} />
                <TextInput
                  value={modelSearch}
                  onChangeText={setModelSearch}
                  placeholder={
                    selectedMake
                      ? `Search ${selectedMake.name} models...`
                      : 'Select a make first...'
                  }
                  placeholderTextColor={ONBOARDING_COLORS.textMuted}
                  editable={!!selectedMake}
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    fontSize: 16,
                    color: ONBOARDING_COLORS.textPrimary,
                    paddingVertical: 14,
                    paddingLeft: 10,
                  }}
                />
              </View>
            )}

            {/* Model dropdown */}
            {showModelDropdown && displayModels.length > 0 && (
              <View
                style={{
                  backgroundColor: ONBOARDING_COLORS.surface2,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  marginTop: 6,
                  overflow: 'hidden',
                }}
              >
                {displayModels.map((model) => (
                  <Pressable
                    key={model.modelName}
                    onPress={() => handleSelectModel(model.modelName)}
                    style={({ pressed }) => ({
                      paddingVertical: 13,
                      paddingHorizontal: 16,
                      backgroundColor: pressed ? ONBOARDING_COLORS.cardBgSelected : 'transparent',
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: ONBOARDING_COLORS.textPrimary,
                        fontWeight: '500',
                      }}
                    >
                      {model.modelName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Free-type model fallback */}
            {noModelResults && (
              <Pressable
                onPress={handleFreetypeModel}
                style={({ pressed }) => ({
                  backgroundColor: ONBOARDING_COLORS.surface2,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  marginTop: 6,
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 15, color: ONBOARDING_COLORS.warm, fontWeight: '500' }}>
                  Use '{modelSearch.trim()}' as model
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* CTA */}
          <Animated.View entering={FadeIn.delay(400).duration(250)} style={{ marginTop: 36 }}>
            <OnboardingContinueButton
              label={t('onboarding.continue')}
              onPress={handleContinue}
              disabled={!year}
            />

            {/* Skip link */}
            <Pressable onPress={handleSkip} style={{ alignSelf: 'center', paddingVertical: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: ONBOARDING_COLORS.textSecondary,
                  fontWeight: '500',
                }}
              >
                {t('onboarding.skipForNow')}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
