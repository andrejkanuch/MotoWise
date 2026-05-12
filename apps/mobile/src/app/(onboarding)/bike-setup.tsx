import {
  MakeStatsDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motovault/graphql';
import { MileageUnit, MotorcycleType, RidingGoal } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandHero } from '../../components/onboarding/bike-setup/brand-hero';
import { MakeGrid } from '../../components/onboarding/bike-setup/make-grid';
import { ModelPicker } from '../../components/onboarding/bike-setup/model-picker';
import { YearInput } from '../../components/onboarding/bike-setup/year-input';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { OB_ROUTE, TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';

const currentYear = new Date().getFullYear();

function detectTypeFromModel(modelName: string): MotorcycleType | null {
  const lower = modelName.toLowerCase();
  if (/ninja|cbr|yzf-r|gsxr|gsx-r|zx|rc\d|panigale|rsv|daytona/i.test(lower))
    return MotorcycleType.SPORTBIKE;
  if (/vulcan|shadow|rebel|scout|sportster|fatboy|softail|dyna|iron\s?\d/i.test(lower))
    return MotorcycleType.CRUISER;
  if (/goldwing|gold wing|electra|road king|road glide|voyager|k\s?1600/i.test(lower))
    return MotorcycleType.TOURING;
  if (/dr-z|drz|klx|crf|wr\d|xr\d|rally|tenere|versys|v-strom|vstrom|tiger|adventure/i.test(lower))
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

  // ── Local state ─────────────────────────────────────────────
  const [year, setYear] = useState(
    existingBikeData?.year ? String(existingBikeData.year) : String(currentYear - 3),
  );
  const [selectedMake, setSelectedMake] = useState<{
    makeId: number;
    makeName: string;
  } | null>(
    existingBikeData?.make && existingBikeData?.makeId
      ? { makeId: existingBikeData.makeId, makeName: existingBikeData.make }
      : null,
  );
  const [isCustomMake, setIsCustomMake] = useState(false);
  const [customMakeName, setCustomMakeName] = useState('');
  const [selectedModel, setSelectedModel] = useState<{
    modelId: number;
    modelName: string;
  } | null>(existingBikeData?.model ? { modelId: 0, modelName: existingBikeData.model } : null);

  // ── Derived ─────────────────────────────────────────────────
  const yearNum = Number.parseInt(year, 10);
  const isValidYear = year.length === 4 && yearNum >= 1970 && yearNum <= currentYear + 1;
  const activeMakeName = isCustomMake ? customMakeName : selectedMake?.makeName;
  const hasMake = !!(selectedMake || (isCustomMake && customMakeName.trim()));
  const canContinue = isValidYear && hasMake;

  // Reset stale state on re-focus (e.g. coming back from paywall)
  useFocusEffect(useCallback(() => {}, []));

  // ── Bridge subtitle based on goals ──────────────────────────
  const bridgeSubtitle = useMemo(() => {
    if (ridingGoals.includes(RidingGoal.TRACK_RIDES))
      return t('onboarding.v2BikeSetupBridgeRides', {
        defaultValue: "We'll set up ride tracking and stats tailored to your motorcycle.",
      });
    if (ridingGoals.includes(RidingGoal.MANAGE_EXPENSES))
      return t('onboarding.v2BikeSetupBridgeExpenses', {
        defaultValue: "We'll help you track costs and find savings for your ride.",
      });
    if (ridingGoals.includes(RidingGoal.DISCOVER_ROUTES))
      return t('onboarding.v2BikeSetupBridgeRoutes', {
        defaultValue: "We'll recommend routes and riding spots matched to your bike.",
      });
    return t('onboarding.v2BikeSetupSubtitle', {
      defaultValue: "We'll personalize everything — service data, specs, and common issues.",
    });
  }, [ridingGoals, t]);

  // ── Queries ─────────────────────────────────────────────────
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const makes = makesResult.data?.motorcycleMakes ?? [];

  const makeStatsResult = useQuery({
    queryKey: ['makeStats'],
    queryFn: () => gqlFetcher(MakeStatsDocument),
    staleTime: 24 * 60 * 60 * 1000, // 24h — fleet stats change slowly
  });
  const makeStats = makeStatsResult.data?.makeStats ?? [];

  const makeIdForModels = selectedMake?.makeId ?? 0;
  const modelsResult = useQuery({
    queryKey: queryKeys.nhtsa.models({ makeId: makeIdForModels, year: yearNum }),
    queryFn: () => gqlFetcher(MotorcycleModelsDocument, { makeId: makeIdForModels, year: yearNum }),
    enabled: makeIdForModels > 0 && isValidYear,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const models = modelsResult.data?.motorcycleModels ?? [];

  // ── Handlers ────────────────────────────────────────────────
  const handleSelectMake = (make: { makeId: number; makeName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMake(make);
    setIsCustomMake(false);
    setCustomMakeName('');
    setSelectedModel(null);
  };

  const handleSelectOther = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsCustomMake(true);
    setSelectedMake(null);
    setSelectedModel(null);
  };

  const handleChangeMake = () => {
    setSelectedMake(null);
    setIsCustomMake(false);
    setCustomMakeName('');
    setSelectedModel(null);
  };

  const handleSelectModel = (model: { modelId: number; modelName: string }) => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedModel(model);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const makeName = activeMakeName ?? '';
    const makeId = isCustomMake ? 0 : (selectedMake?.makeId ?? 0);
    const modelName = selectedModel?.modelName ?? '';
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
      is_custom_make: isCustomMake,
      type_auto_detected: !!detectedType,
    });

    router.push(OB_ROUTE.PAYWALL);
  };

  const handleSkip = () => {
    setBikeData(null);
    trackEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, {
      step: 'bike_setup',
      step_index: 3,
      skipped_section: 'bike_setup',
    });
    router.push(OB_ROUTE.PAYWALL);
  };

  // ── Stage: make selected vs not ─────────────────────────────
  const showBrandHero = !!selectedMake || (isCustomMake && !!customMakeName.trim());

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={3} totalScreens={TOTAL_SCREENS} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header — tap to dismiss keyboard */}
        <Pressable onPress={Keyboard.dismiss} style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              position: 'absolute',
              top: 0,
              left: 16,
              zIndex: 10,
              width: 36,
              height: 36,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: ONBOARDING_COLORS.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
          </Pressable>

          <View style={{ height: 48 }} />

          <Animated.View entering={FadeInDown.duration(300)}>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 30,
                lineHeight: 32,
                color: ONBOARDING_COLORS.textPrimary,
                letterSpacing: -0.5,
                marginBottom: 8,
              }}
            >
              Tell us about{'\n'}
              <Text
                style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}
              >
                your bike.
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 19,
                maxWidth: 330,
              }}
            >
              {bridgeSubtitle}
            </Text>
          </Animated.View>
        </Pressable>

        {/* Scrollable content */}
        <ScrollView
          style={{ flex: 1, marginTop: 20 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!showBrandHero ? (
            /* ═══ Stage A: Year + Make grid ═══ */
            <>
              <YearInput value={year} onChange={setYear} isValid={isValidYear} />
              <MakeGrid
                makes={makes}
                stats={makeStats}
                onSelect={handleSelectMake}
                onSelectOther={handleSelectOther}
              />
            </>
          ) : (
            /* ═══ Stage B: Brand hero + model picker ═══ */
            <>
              {/* Compact year pill */}
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 8,
                  paddingLeft: 14,
                  paddingRight: 12,
                  borderRadius: 999,
                  backgroundColor: '#1a1812',
                  borderWidth: 1,
                  borderColor: '#2a2520',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'GeistMono-Medium',
                    fontSize: 9.5,
                    fontWeight: '600',
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.42)',
                  }}
                >
                  Year
                </Text>
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={{
                    width: 52,
                    textAlign: 'center',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: 16,
                    letterSpacing: 1,
                    padding: 0,
                  }}
                />
              </View>

              {/* Custom make name input (only for "Other") */}
              {isCustomMake && !customMakeName.trim() && (
                <View>
                  <Text style={sectionLabel}>Make name</Text>
                  <TextInput
                    value={customMakeName}
                    onChangeText={setCustomMakeName}
                    placeholder="Type your make…"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="words"
                    autoFocus
                    style={{
                      backgroundColor: '#1a1812',
                      borderWidth: 1,
                      borderColor: '#2a2520',
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      padding: 14,
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '600',
                    }}
                  />
                </View>
              )}

              {/* Brand hero (only when we have a name) */}
              {activeMakeName && (
                <>
                  <BrandHero
                    makeName={activeMakeName}
                    isCustom={isCustomMake}
                    stats={makeStats}
                    onChangeMake={handleChangeMake}
                  />

                  <ModelPicker
                    makeName={activeMakeName}
                    isCustomMake={isCustomMake}
                    models={models}
                    isLoading={modelsResult.isLoading}
                    selectedModel={selectedModel}
                    onSelect={handleSelectModel}
                    onDismiss={() => setSelectedModel(null)}
                  />
                </>
              )}
            </>
          )}
        </ScrollView>

        {/* Bottom actions */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: insets.bottom + 16,
            backgroundColor: ONBOARDING_COLORS.background,
          }}
        >
          <OnboardingContinueButton
            label={t('onboarding.continue', { defaultValue: 'Continue' })}
            onPress={handleContinue}
            disabled={!canContinue}
          />
          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip bike setup"
            style={{ alignSelf: 'center', marginTop: 14, padding: 8 }}
          >
            <Text
              style={{
                fontSize: 14.5,
                color: 'rgba(255,255,255,0.55)',
                fontWeight: '500',
                textDecorationLine: 'underline',
                textDecorationColor: 'rgba(255,255,255,0.2)',
                letterSpacing: -0.1,
              }}
            >
              I'll add my bike later
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const sectionLabel = {
  fontSize: 11,
  fontWeight: '600' as const,
  letterSpacing: 1.5,
  textTransform: 'uppercase' as const,
  color: 'rgba(255,255,255,0.42)',
  marginBottom: 12,
  paddingLeft: 2,
};
