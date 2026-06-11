import {
  MakeStatsDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
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
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandHero } from '../../components/onboarding/bike-setup/brand-hero';
import { MakeGrid } from '../../components/onboarding/bike-setup/make-grid';
import { ModelPicker } from '../../components/onboarding/bike-setup/model-picker';
import { YearStepper } from '../../components/onboarding/bike-setup/year-stepper';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getBrandDna, MAKE_COLORS, POPULAR_MAKES } from '../../config/brand-dna';
import { OB_SCREEN } from '../../config/onboarding';
import { useMileageUnit } from '../../hooks/use-mileage-unit';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { triggerImpact } from '../../utils/haptics';

const currentYear = new Date().getFullYear();

// Map a brand's visual archetype (from getBrandDna) to a MotorcycleType so
// make-only partial captures still get a sensible default type.
const ARCHETYPE_TO_TYPE: Record<string, MotorcycleType> = {
  sport: MotorcycleType.SPORTBIKE,
  adv: MotorcycleType.DUAL_SPORT,
  cruiser: MotorcycleType.CRUISER,
};

function typeFromMake(makeName: string): MotorcycleType {
  const dna = getBrandDna(makeName);
  return (dna && ARCHETYPE_TO_TYPE[dna.type]) ?? MotorcycleType.STANDARD;
}

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
  const onBack = useOnboardingBack(OB_SCREEN.BIKE_SETUP);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.BIKE_SETUP);
  const goNext = useOnboardingNext(OB_SCREEN.BIKE_SETUP);
  const insets = useSafeAreaInsets();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);
  // Seed the unit from the user's profile preference (the per-bike unit is deprecated).
  const mileageUnit = useMileageUnit();

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
  const [showPartialCapture, setShowPartialCapture] = useState(false);

  // ── Derived ─────────────────────────────────────────────────
  const yearNum = Number.parseInt(year, 10);
  const isValidYear = year.length === 4 && yearNum >= 1970 && yearNum <= currentYear + 1;
  const activeMakeName = isCustomMake ? customMakeName : selectedMake?.makeName;
  const hasMake = !!(selectedMake || (isCustomMake && customMakeName.trim()));
  const canContinue = isValidYear && hasMake;

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.BIKE_SETUP);
  }, []);

  // ── Stage: make selected vs not ─────────────────────────────
  // Leave the grid (Stage A) once a make is picked OR "Other make" is tapped —
  // the latter reveals the custom-name input even before a name is typed.
  const showMakeDetails = !!selectedMake || isCustomMake;
  // Brand hero/headline only once we actually have a name to show.
  const showBrandHero = !!selectedMake || (isCustomMake && !!customMakeName.trim());

  // ── Dynamic headline + reward subtitle (empty → picked) ─────
  const headline = useMemo(() => {
    if (showBrandHero && activeMakeName) {
      return {
        lead: t('onboarding.v2BikeSetupTitlePicked' as never),
        accent: t('onboarding.v2BikeSetupTitlePickedAccent' as never, {
          makeName: activeMakeName,
        }) as string,
        sub: isCustomMake
          ? t('onboarding.v2BikeSetupSubtitleReward' as never)
          : (getBrandDna(activeMakeName)?.tagline ??
            t('onboarding.v2BikeSetupSubtitleReward' as never)),
      };
    }
    return {
      lead: t('onboarding.v2BikeSetupTitleEmpty' as never),
      accent: t('onboarding.v2BikeSetupTitleEmptyAccent' as never),
      sub: t('onboarding.v2BikeSetupSubtitleReward' as never),
    };
  }, [showBrandHero, activeMakeName, isCustomMake, t]);

  // ── Queries ─────────────────────────────────────────────────
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const makes = makesResult.data?.motorcycleMakes ?? [];

  // First 4 popular makes (matched to real NHTSA make ids) for the partial-capture chips.
  const quickMakes = useMemo(() => {
    return POPULAR_MAKES.slice(0, 4)
      .map((name) => makes.find((m) => m.makeName.toLowerCase() === name.toLowerCase()) ?? null)
      .filter((m): m is (typeof makes)[number] => m !== null);
  }, [makes]);

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
    triggerImpact();
    setSelectedMake(make);
    setIsCustomMake(false);
    setCustomMakeName('');
    setSelectedModel(null);
  };

  const handleSelectOther = () => {
    triggerImpact();
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
    triggerImpact();
    setSelectedModel(model);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    triggerImpact(ImpactFeedbackStyle.Medium);

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
      mileageUnit: existingBikeData?.mileageUnit ?? mileageUnit,
    });

    setLastCompletedScreen(OB_SCREEN.BIKE_SETUP);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.BIKE_SETUP, {
      bike_year: yearNum,
      bike_make: makeName,
      bike_model: modelName || 'skipped',
      is_custom_make: isCustomMake,
      type_auto_detected: !!detectedType,
    });

    // Activation metric — fires for full (make+model) and partial (make-only)
    // capture so the install→bike-add guardrail counts both. See the A/B schema.
    trackOnboardingEvent(AnalyticsEvent.BIKE_ADDED, OB_SCREEN.BIKE_SETUP, {
      capture_level: modelName ? 'model' : 'make',
      bike_make: makeName,
      bike_year: yearNum,
    });

    goNext();
  };

  // Make-only partial capture — picking a quick chip creates a make-level bike
  // (year defaulted, make/makeId set, no model, type inferred from brand DNA)
  // and advances. Emits bike_added with capture_level: 'make'.
  const handleQuickMake = (make: { makeId: number; makeName: string }) => {
    triggerImpact(ImpactFeedbackStyle.Medium);

    setBikeData({
      year: yearNum,
      make: make.makeName,
      makeId: make.makeId,
      model: '',
      type: typeFromMake(make.makeName),
      currentMileage: existingBikeData?.currentMileage ?? 0,
      mileageUnit: existingBikeData?.mileageUnit ?? mileageUnit,
    });

    setLastCompletedScreen(OB_SCREEN.BIKE_SETUP);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, OB_SCREEN.BIKE_SETUP, {
      bike_year: yearNum,
      bike_make: make.makeName,
      bike_model: 'skipped',
      is_custom_make: false,
      type_auto_detected: false,
    });

    trackOnboardingEvent(AnalyticsEvent.BIKE_ADDED, OB_SCREEN.BIKE_SETUP, {
      capture_level: 'make',
      bike_make: make.makeName,
      bike_year: yearNum,
    });

    goNext();
  };

  const handleSkip = () => {
    setBikeData(null);
    setLastCompletedScreen(OB_SCREEN.BIKE_SETUP);
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_SKIPPED, OB_SCREEN.BIKE_SETUP, {
      skipped_section: 'bike_setup',
    });
    goNext();
  };

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header — tap to dismiss keyboard */}
        <View
          onStartShouldSetResponder={() => {
            Keyboard.dismiss();
            return false;
          }}
          style={{ paddingHorizontal: 24, paddingTop: 12 }}
        >
          <OnboardingBackButton
            onPress={onBack}
            style={{ position: 'absolute', top: 0, left: 16, zIndex: 10 }}
          />

          <View style={{ height: 48 }} />

          <EyebrowPill
            accent={ONBOARDING_COLORS.warm2}
            label={t('onboarding.v2BikeSetupEyebrow' as never)}
          />

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
              {headline.lead}
              {'\n'}
              <Text
                style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}
              >
                {headline.accent}
              </Text>
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: ONBOARDING_COLORS.textSoft,
                lineHeight: 19,
                maxWidth: 330,
              }}
            >
              {headline.sub}
            </Text>
          </Animated.View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={{ flex: 1, marginTop: 20 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {!showMakeDetails ? (
            /* ═══ Stage A: Make grid (year is set after a make is picked) ═══ */
            <MakeGrid
              makes={makes}
              stats={makeStats}
              onSelect={handleSelectMake}
              onSelectOther={handleSelectOther}
            />
          ) : (
            /* ═══ Stage B: Brand hero + model picker ═══ */
            <>
              {/* Model year stepper */}
              <YearStepper value={year} onChange={setYear} onStep={triggerImpact} />

              {/* Custom make name input (only for "Other") */}
              {isCustomMake && !customMakeName.trim() && (
                <View>
                  <Text style={sectionLabel}>{t('onboarding.v2BikeSetupMakeName')}</Text>
                  <TextInput
                    value={customMakeName}
                    onChangeText={setCustomMakeName}
                    placeholder={t('onboarding.v2BikeSetupMakeNamePlaceholder')}
                    placeholderTextColor={ONBOARDING_COLORS.textDimmed}
                    autoCapitalize="words"
                    maxLength={50}
                    autoFocus
                    style={{
                      backgroundColor: ONBOARDING_COLORS.surfaceInput,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.borderSubtle,
                      borderRadius: 14,
                      borderCurve: 'continuous',
                      padding: 14,
                      color: ONBOARDING_COLORS.textWhite,
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
          {/* Make-only partial capture — reveals quick make chips. */}
          {!showMakeDetails && showPartialCapture && quickMakes.length > 0 && (
            <Animated.View
              entering={FadeInDown.duration(260)}
              style={{
                marginBottom: 12,
                padding: 14,
                borderRadius: 16,
                borderCurve: 'continuous',
                backgroundColor: ONBOARDING_COLORS.surfaceInput,
                borderWidth: 1,
                borderColor: ONBOARDING_COLORS.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontSize: 12.5,
                  color: ONBOARDING_COLORS.textSoft,
                  lineHeight: 18,
                  marginBottom: 10,
                }}
              >
                {t('onboarding.v2BikeSetupPartialHelper' as never)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {quickMakes.map((m) => (
                  <Pressable
                    key={m.makeId}
                    onPress={() => handleQuickMake(m)}
                    accessibilityRole="button"
                    accessibilityLabel={m.makeName}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      backgroundColor: ONBOARDING_COLORS.surfaceCardTranslucent,
                      borderWidth: 1,
                      borderColor: ONBOARDING_COLORS.borderSubtle,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        borderCurve: 'continuous',
                        backgroundColor: MAKE_COLORS[m.makeName] ?? ONBOARDING_COLORS.warm,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: ONBOARDING_COLORS.textWhite,
                        }}
                      >
                        {m.makeName[0]}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: ONBOARDING_COLORS.textPrimary,
                      }}
                    >
                      {m.makeName}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* True skip — no bike, keeps existing handleSkip navigation. */}
              <Pressable
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip bike setup"
                style={{ alignSelf: 'flex-start', marginTop: 12, paddingVertical: 4 }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: ONBOARDING_COLORS.textFaded,
                    fontWeight: '500',
                    textDecorationLine: 'underline',
                    textDecorationColor: ONBOARDING_COLORS.underlineSubtle,
                  }}
                >
                  {t('onboarding.v2BikeSetupSkip')}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          <OnboardingContinueButton
            label={t('onboarding.v2BikeSetupCta' as never)}
            onPress={handleContinue}
            disabled={!canContinue}
          />
          <Pressable
            onPress={() => {
              // With a make picked / custom entry open, the footer is a true skip.
              // In the empty grid it reveals the make-only partial-capture chips.
              if (showMakeDetails) {
                handleSkip();
              } else {
                triggerImpact();
                setShowPartialCapture((v) => !v);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={showMakeDetails ? 'Skip bike setup' : 'Not sure of the details'}
            style={{ alignSelf: 'center', marginTop: 14, padding: 8 }}
          >
            <Text
              style={{
                fontSize: 14.5,
                color: ONBOARDING_COLORS.textSubtitle,
                fontWeight: '500',
                textDecorationLine: 'underline',
                textDecorationColor: ONBOARDING_COLORS.underlineSubtle,
                letterSpacing: -0.1,
              }}
            >
              {showMakeDetails
                ? t('onboarding.v2BikeSetupSkip')
                : t('onboarding.v2BikeSetupNotSure' as never)}
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
  color: ONBOARDING_COLORS.textLabel,
  marginBottom: 12,
  paddingLeft: 2,
};

// Eyebrow pill — matches the styling used on experience.tsx (pulsing dot + caps mono label).
function EyebrowPill({ accent, label }: { accent: string; label: string }) {
  const dotScale = useSharedValue(1);

  useEffect(() => {
    dotScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [dotScale]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(100).duration(500)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: `${accent}1F`,
        borderWidth: 1,
        borderColor: `${accent}4D`,
        marginBottom: 14,
      }}
    >
      <Animated.View
        style={[{ width: 4, height: 4, borderRadius: 2, backgroundColor: accent }, dotStyle]}
      />
      <Text
        style={{
          fontFamily: 'GeistMono-Medium',
          fontSize: 9.5,
          fontWeight: '600',
          letterSpacing: 1.7,
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
