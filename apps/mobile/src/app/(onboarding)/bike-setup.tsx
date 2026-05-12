import { MotorcycleMakesDocument, MotorcycleModelsDocument } from '@motovault/graphql';
import { MileageUnit, MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, SkipForward, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';

const currentYear = new Date().getFullYear();
const defaultYear = String(currentYear - 3);

/** Design-spec badge colors for popular makes */
const POPULAR_MAKE_BADGES: Record<string, { letter: string; color: string }> = {
  Honda: { letter: 'H', color: '#DC2626' },
  Yamaha: { letter: 'Y', color: '#2563EB' },
  Kawasaki: { letter: 'K', color: '#16A34A' },
  Suzuki: { letter: 'S', color: '#2563EB' },
  BMW: { letter: 'B', color: '#2563EB' },
  Ducati: { letter: 'D', color: '#DC2626' },
};

const POPULAR_MAKE_NAMES = ['Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'BMW', 'Ducati'];

function detectTypeFromModel(modelName: string): MotorcycleType | null {
  const lower = modelName.toLowerCase();
  if (/ninja|cbr|yzf-r|gsxr|gsx-r|zx|rc\d|panigale|rsv|daytona/i.test(lower))
    return MotorcycleType.SPORTBIKE;
  if (/vulcan|shadow|rebel|scout|sportster|fatboy|softail|dyna|iron\s?\d/i.test(lower))
    return MotorcycleType.CRUISER;
  if (/goldwing|gold wing|electra|road king|road glide|voyager|k\s?1600/i.test(lower))
    return MotorcycleType.TOURING;
  if (
    /dr-z|drz|klx|crf|wr\d|xr\d|rally|tenere|versys|v-strom|vstrom|tiger|adventure/i.test(lower)
  )
    return MotorcycleType.DUAL_SPORT;
  if (/crf\d+f|yz\d+f|kx\d+|rm-z|rmz|tc\d|fc\d|sx|exc/i.test(lower))
    return MotorcycleType.DIRT_BIKE;
  if (/scooter|vespa|pcx|nmax|xmax|burgman|forza|metropolitan|scoopy/i.test(lower))
    return MotorcycleType.SCOOTER;
  return null;
}

export default function BikeSetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);
  const ridingGoals = useOnboardingStore((s) => s.ridingGoals);

  // ── Local state (batch-written on Continue) ──────────────────────
  const [year, setYear] = useState(
    existingBikeData?.year ? String(existingBikeData.year) : defaultYear,
  );
  const [makeSearch, setMakeSearch] = useState('');
  const [selectedMake, setSelectedMake] = useState<{
    makeId: number;
    makeName: string;
  } | null>(
    existingBikeData?.make && existingBikeData?.makeId
      ? { makeId: existingBikeData.makeId, makeName: existingBikeData.make }
      : null,
  );
  const [customMake, setCustomMake] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModel, setSelectedModel] = useState<{
    modelId: number;
    modelName: string;
  } | null>(
    existingBikeData?.model && existingBikeData.model !== ''
      ? { modelId: 0, modelName: existingBikeData.model }
      : null,
  );

  // ── Derived state ────────────────────────────────────────────────
  const yearNum = Number.parseInt(year, 10);
  const isValidYear = year.length === 4 && yearNum >= 1970 && yearNum <= currentYear + 1;
  const hasMake = !!(selectedMake || customMake.trim());
  const canContinue = isValidYear && hasMake;

  // ── Dynamic bridge subtitle based on goals ───────────────────────
  const bridgeSubtitle = useMemo(() => {
    if (ridingGoals.includes('track_maintenance' as never))
      return t('onboarding.v2BikeSetupBridgeMaintenance', {
        defaultValue: "We'll set up service intervals and maintenance tracking for your ride.",
      });
    if (ridingGoals.includes('save_money' as never) || ridingGoals.includes('save_on_maintenance' as never))
      return t('onboarding.v2BikeSetupBridgeSavings', {
        defaultValue: "We'll find cost-saving tips specific to your motorcycle.",
      });
    return t('onboarding.v2BikeSetupBridgeDefault', {
      defaultValue: "We'll personalize everything — service data, specs, and common issues.",
    });
  }, [ridingGoals, t]);

  // ── NHTSA makes query ────────────────────────────────────────────
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const makes = makesResult.data?.motorcycleMakes ?? [];

  const popularMakeItems = makes.filter((m: { makeName: string }) =>
    POPULAR_MAKE_NAMES.some((p) => p.toLowerCase() === m.makeName.toLowerCase()),
  );

  const filteredMakes =
    makeSearch.length > 0
      ? makes.filter((make: { makeName: string }) =>
          make.makeName.toLowerCase().includes(makeSearch.toLowerCase()),
        )
      : [];

  const showMakeDropdown = makeSearch.length > 0 && filteredMakes.length > 0;
  const showMakeNoResults =
    makeSearch.length > 0 && filteredMakes.length === 0 && !makesResult.isLoading;
  const showMakeGrid = !makeSearch && !selectedMake && !customMake && popularMakeItems.length > 0;

  // ── NHTSA models query ───────────────────────────────────────────
  const makeIdForModels = selectedMake?.makeId ?? 0;
  const modelsResult = useQuery({
    queryKey: queryKeys.nhtsa.models({ makeId: makeIdForModels, year: yearNum }),
    queryFn: () =>
      gqlFetcher(MotorcycleModelsDocument, {
        makeId: makeIdForModels,
        year: yearNum,
      }),
    enabled: makeIdForModels > 0 && isValidYear,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const models = modelsResult.data?.motorcycleModels ?? [];

  const filteredModels =
    modelSearch.length > 0
      ? models.filter((model) => model.modelName.toLowerCase().includes(modelSearch.toLowerCase()))
      : models;

  // ── Handlers ─────────────────────────────────────────────────────
  const handleSelectMake = (make: { makeId: number; makeName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMake(make);
    setMakeSearch('');
    setCustomMake('');
    // Reset model when make changes
    setSelectedModel(null);
    setModelSearch('');
  };

  const handleDismissMake = () => {
    setSelectedMake(null);
    setCustomMake('');
    setSelectedModel(null);
    setModelSearch('');
  };

  const handleSelectModel = (model: { modelId: number; modelName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedModel(model);
    setModelSearch('');
  };

  const handleDismissModel = () => {
    setSelectedModel(null);
    setModelSearch('');
  };

  const handleContinue = () => {
    if (!canContinue) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const makeName = customMake.trim() || selectedMake?.makeName || '';
    const makeId = customMake.trim() ? 0 : (selectedMake?.makeId ?? 0);
    const modelName = selectedModel?.modelName || '';
    const detectedType = modelName ? detectTypeFromModel(modelName) : null;

    setBikeData({
      year: yearNum,
      make: makeName,
      makeId,
      model: modelName,
      type: detectedType ?? MotorcycleType.STANDARD,
      currentMileage: existingBikeData?.currentMileage ?? 0,
      mileageUnit: existingBikeData?.mileageUnit ?? MileageUnit.MI,
    });

    trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
      step: 'bike_setup',
      step_index: 3,
      bike_year: yearNum,
      bike_make: makeName,
      bike_model: modelName || 'skipped',
      is_custom_make: !!customMake.trim(),
      type_auto_detected: !!detectedType,
    });

    router.replace('/(onboarding)/paywall');
  };

  const handleSkip = () => {
    setBikeData(null);
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, {
      step: 'bike_setup',
      step_index: 3,
      skipped_section: 'bike_setup',
    });
    router.replace('/(onboarding)/paywall');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {/* ── Header ──────────────────────────────────── */}
            <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24 }}>
              {/* Back chevron */}
              <Pressable
                onPress={handleBack}
                hitSlop={12}
                style={({ pressed }) => ({
                  alignSelf: 'flex-start',
                  opacity: pressed ? 0.6 : 1,
                  marginBottom: 16,
                })}
              >
                <ChevronLeft size={24} color={ONBOARDING_COLORS.textSecondary} />
              </Pressable>

              {/* Progress bar — step 4 of 7 */}
              <View style={{ flexDirection: 'row', gap: 4, marginBottom: 26 }}>
                {Array.from({ length: 7 }, (_, i) => `progress-${i}`).map((key, i) => (
                  <View
                    key={key}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      borderCurve: 'continuous',
                      backgroundColor:
                        i < 4 ? ONBOARDING_COLORS.warm : ONBOARDING_COLORS.surface2,
                    }}
                  />
                ))}
              </View>

              {/* Headline */}
              <Animated.View entering={FadeInDown.duration(300)}>
                <Text
                  style={{
                    fontFamily: 'InstrumentSerif-Regular',
                    fontSize: 36,
                    lineHeight: 40,
                    color: ONBOARDING_COLORS.textPrimary,
                    letterSpacing: -0.7,
                    marginBottom: 4,
                  }}
                >
                  Tell us about{' '}
                  <Text
                    style={{
                      fontFamily: 'InstrumentSerif-Italic',
                      color: ONBOARDING_COLORS.warm,
                    }}
                  >
                    your bike.
                  </Text>
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: ONBOARDING_COLORS.textSecondary,
                    lineHeight: 20,
                    marginBottom: 4,
                  }}
                >
                  {bridgeSubtitle}
                </Text>
              </Animated.View>
            </View>

            {/* ── Scrollable content ──────────────────────── */}
            <ScrollView
              style={{ flex: 1, marginTop: 20 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* ── YEAR SECTION ────────────────────────────── */}
              <Animated.View entering={FadeInUp.delay(100).duration(300)}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: ONBOARDING_COLORS.textMuted,
                    marginBottom: 10,
                  }}
                >
                  {t('onboarding.yearPlaceholder', { defaultValue: 'YEAR' })}
                </Text>
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  placeholder="2023"
                  placeholderTextColor={ONBOARDING_COLORS.textDimmed}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={{
                    backgroundColor: ONBOARDING_COLORS.cardBg,
                    borderWidth: 1,
                    borderColor: isValidYear
                      ? `${ONBOARDING_COLORS.warm}80`
                      : ONBOARDING_COLORS.cardBorder,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    padding: 18,
                    fontSize: 28,
                    fontWeight: '700',
                    color: ONBOARDING_COLORS.textPrimary,
                    textAlign: 'center',
                    letterSpacing: 4,
                  }}
                />
                {year.length === 4 && !isValidYear && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: ONBOARDING_COLORS.error,
                      marginTop: 6,
                      textAlign: 'center',
                    }}
                  >
                    {t('onboarding.bikeYearInvalid')}
                  </Text>
                )}
              </Animated.View>

              {/* ── MAKE SECTION ─────────────────────────────── */}
              <Animated.View
                entering={FadeInUp.delay(200).duration(300)}
                style={{ marginTop: 28 }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: ONBOARDING_COLORS.textMuted,
                    marginBottom: 10,
                  }}
                >
                  {t('onboarding.bikeMakeLabel', { defaultValue: 'MAKE' })}
                </Text>

                {/* Selected make chip */}
                {selectedMake && !makeSearch ? (
                  <Pressable
                    onPress={handleDismissMake}
                    style={({ pressed }) => ({
                      backgroundColor: `${ONBOARDING_COLORS.warm}24`,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.warm,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        borderCurve: 'continuous',
                        backgroundColor:
                          POPULAR_MAKE_BADGES[selectedMake.makeName]?.color ??
                          ONBOARDING_COLORS.surface2,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>
                        {selectedMake.makeName[0]}
                      </Text>
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                        letterSpacing: -0.1,
                      }}
                    >
                      {selectedMake.makeName}
                    </Text>
                    <X size={16} color={ONBOARDING_COLORS.ink3} />
                  </Pressable>
                ) : customMake && !makeSearch ? (
                  <Pressable
                    onPress={handleDismissMake}
                    style={({ pressed }) => ({
                      backgroundColor: `${ONBOARDING_COLORS.warm}24`,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.warm,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 15,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                    >
                      {customMake}
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: ONBOARDING_COLORS.warm, fontWeight: '600' }}
                    >
                      Custom
                    </Text>
                    <X size={16} color={ONBOARDING_COLORS.ink3} style={{ marginLeft: 8 }} />
                  </Pressable>
                ) : (
                  /* Make search bar */
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: ONBOARDING_COLORS.surface,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.line,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      paddingHorizontal: 14,
                      gap: 10,
                    }}
                  >
                    <Search size={16} color={ONBOARDING_COLORS.ink3} />
                    <TextInput
                      value={makeSearch}
                      onChangeText={setMakeSearch}
                      placeholder={t('onboarding.searchMakePlaceholder', {
                        defaultValue: 'Search any make...',
                      })}
                      placeholderTextColor={ONBOARDING_COLORS.ink3}
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        fontSize: 15,
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                    />
                  </View>
                )}

                {/* Loading */}
                {makesResult.isLoading && (
                  <ActivityIndicator
                    color={ONBOARDING_COLORS.warm}
                    style={{ marginVertical: 16 }}
                  />
                )}

                {/* Search results dropdown */}
                {showMakeDropdown && (
                  <Animated.View entering={FadeInUp.duration(200)} style={{ marginTop: 8 }}>
                    <View
                      style={{
                        backgroundColor: ONBOARDING_COLORS.surface,
                        borderWidth: 1,
                        borderColor: ONBOARDING_COLORS.line,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        maxHeight: 220,
                        overflow: 'hidden',
                      }}
                    >
                      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredMakes.slice(0, 20).map((make) => (
                          <Pressable
                            key={make.makeId}
                            onPress={() => handleSelectMake(make)}
                            style={({ pressed }) => ({
                              paddingHorizontal: 16,
                              paddingVertical: 13,
                              borderBottomWidth: 1,
                              borderBottomColor: ONBOARDING_COLORS.line,
                              backgroundColor: pressed
                                ? ONBOARDING_COLORS.surface2
                                : 'transparent',
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
                      </ScrollView>
                    </View>
                  </Animated.View>
                )}

                {/* No results — offer custom make */}
                {showMakeNoResults && (
                  <Animated.View
                    entering={FadeInUp.duration(200)}
                    style={{ gap: 8, marginTop: 8 }}
                  >
                    <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.ink3, paddingLeft: 4 }}>
                      {t('onboarding.noMakesFound', { defaultValue: 'No makes found' })}
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (process.env.EXPO_OS === 'ios') {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setCustomMake(makeSearch);
                        setMakeSearch('');
                        setSelectedMake(null);
                        setSelectedModel(null);
                        setModelSearch('');
                      }}
                      style={{
                        backgroundColor: ONBOARDING_COLORS.surface,
                        borderWidth: 1,
                        borderColor: ONBOARDING_COLORS.warm,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: ONBOARDING_COLORS.warm,
                          fontWeight: '600',
                          flexShrink: 1,
                        }}
                      >
                        {t('onboarding.useCustomMake', { make: makeSearch })}
                      </Text>
                      <ChevronRight size={16} color={ONBOARDING_COLORS.warm} />
                    </Pressable>
                  </Animated.View>
                )}

                {/* Popular makes 2-column grid */}
                {showMakeGrid && !makesResult.isLoading && (
                  <Animated.View
                    entering={FadeInUp.delay(100).duration(300)}
                    style={{ marginTop: 12 }}
                  >
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {popularMakeItems.map((make, index) => {
                        const badge = POPULAR_MAKE_BADGES[make.makeName];
                        return (
                          <Animated.View
                            key={make.makeId}
                            entering={FadeInUp.delay(150 + index * 50).duration(250)}
                            style={{ width: '48.5%' }}
                          >
                            <Pressable
                              onPress={() => handleSelectMake(make)}
                              style={({ pressed }) => ({
                                padding: 16,
                                borderRadius: 14,
                                borderCurve: 'continuous',
                                backgroundColor: pressed
                                  ? ONBOARDING_COLORS.surface2
                                  : ONBOARDING_COLORS.surface,
                                borderWidth: 1,
                                borderColor: ONBOARDING_COLORS.line,
                                gap: 10,
                              })}
                            >
                              <View
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 8,
                                  borderCurve: 'continuous',
                                  backgroundColor: badge?.color ?? ONBOARDING_COLORS.surface2,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '700',
                                    color: '#FFFFFF',
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {badge?.letter ?? make.makeName[0]}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '600',
                                  color: ONBOARDING_COLORS.textPrimary,
                                  letterSpacing: -0.1,
                                }}
                              >
                                {make.makeName}
                              </Text>
                            </Pressable>
                          </Animated.View>
                        );
                      })}
                      {/* "Other" card with dashed border */}
                      <View style={{ width: '48.5%' }}>
                        <Pressable
                          onPress={() => {
                            setMakeSearch(' ');
                            setTimeout(() => setMakeSearch(''), 0);
                          }}
                          style={{
                            padding: 16,
                            borderRadius: 14,
                            borderCurve: 'continuous',
                            backgroundColor: ONBOARDING_COLORS.surface,
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            borderColor: ONBOARDING_COLORS.line,
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 82,
                          }}
                        >
                          <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.ink3 }}>
                            + Other
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>

              {/* ── MODEL SECTION (appears after make selected) ──── */}
              {hasMake && isValidYear && (
                <Animated.View
                  entering={FadeInUp.delay(100).duration(300)}
                  style={{ marginTop: 28 }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      color: ONBOARDING_COLORS.textMuted,
                      marginBottom: 10,
                    }}
                  >
                    {t('onboarding.bikeModelLabel', { defaultValue: 'MODEL (OPTIONAL)' })}
                  </Text>

                  {/* Selected model chip */}
                  {selectedModel ? (
                    <Pressable
                      onPress={handleDismissModel}
                      style={({ pressed }) => ({
                        backgroundColor: `${ONBOARDING_COLORS.warm}24`,
                        borderWidth: 1,
                        borderColor: ONBOARDING_COLORS.warm,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        padding: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 15,
                          fontWeight: '600',
                          color: ONBOARDING_COLORS.textPrimary,
                        }}
                      >
                        {selectedModel.modelName}
                      </Text>
                      <X size={16} color={ONBOARDING_COLORS.ink3} />
                    </Pressable>
                  ) : (
                    /* Model search bar */
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: ONBOARDING_COLORS.surface,
                        borderWidth: 1,
                        borderColor: ONBOARDING_COLORS.line,
                        borderRadius: 14,
                        borderCurve: 'continuous',
                        paddingHorizontal: 14,
                        gap: 10,
                      }}
                    >
                      <Search size={16} color={ONBOARDING_COLORS.ink3} />
                      <TextInput
                        value={modelSearch}
                        onChangeText={setModelSearch}
                        placeholder={t('onboarding.searchModelPlaceholder', {
                          defaultValue: 'Search model...',
                        })}
                        placeholderTextColor={ONBOARDING_COLORS.ink3}
                        style={{
                          flex: 1,
                          paddingVertical: 14,
                          fontSize: 15,
                          color: ONBOARDING_COLORS.textPrimary,
                        }}
                      />
                    </View>
                  )}

                  {/* Model loading */}
                  {modelsResult.isLoading && (
                    <ActivityIndicator
                      color={ONBOARDING_COLORS.warm}
                      style={{ marginVertical: 16 }}
                    />
                  )}

                  {/* Models list */}
                  {!selectedModel && filteredModels.length > 0 && !modelsResult.isLoading && (
                    <Animated.View entering={FadeInUp.duration(200)} style={{ marginTop: 8 }}>
                      <View
                        style={{
                          backgroundColor: ONBOARDING_COLORS.surface,
                          borderWidth: 1,
                          borderColor: ONBOARDING_COLORS.line,
                          borderRadius: 14,
                          borderCurve: 'continuous',
                          maxHeight: 240,
                          overflow: 'hidden',
                        }}
                      >
                        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                          {filteredModels.slice(0, 30).map((model) => (
                            <Pressable
                              key={model.modelId}
                              onPress={() => handleSelectModel(model)}
                              style={({ pressed }) => ({
                                paddingHorizontal: 16,
                                paddingVertical: 13,
                                borderBottomWidth: 1,
                                borderBottomColor: ONBOARDING_COLORS.line,
                                backgroundColor: pressed
                                  ? ONBOARDING_COLORS.surface2
                                  : 'transparent',
                              })}
                            >
                              <Text
                                style={{
                                  fontSize: 15,
                                  color: ONBOARDING_COLORS.textPrimary,
                                }}
                              >
                                {model.modelName}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    </Animated.View>
                  )}

                  {/* Helper text */}
                  <Text
                    style={{
                      fontSize: 13,
                      color: ONBOARDING_COLORS.ink3,
                      fontStyle: 'italic',
                      marginTop: 10,
                    }}
                  >
                    {t('onboarding.modelOptionalHelper', {
                      defaultValue: 'You can add this later',
                    })}
                  </Text>
                </Animated.View>
              )}
            </ScrollView>

            {/* ── Bottom CTA ──────────────────────────────── */}
            <View
              style={{
                paddingHorizontal: 24,
                paddingBottom: insets.bottom + 16,
                gap: 8,
              }}
            >
              <OnboardingContinueButton
                label={t('onboarding.continue')}
                onPress={handleContinue}
                disabled={!canContinue}
              />

              <Pressable
                onPress={handleSkip}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <SkipForward size={14} color={ONBOARDING_COLORS.textMuted} />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textMuted,
                  }}
                >
                  {t('onboarding.skipBikeLater', {
                    defaultValue: "I'll add my bike later",
                  })}
                </Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}
