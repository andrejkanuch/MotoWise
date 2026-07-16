import {
  MakeStatsDocument,
  MotorcycleMakesDocument,
  MotorcycleModelsDocument,
} from '@motovault/graphql';
import { MotorcycleType, type MotorcycleVariant } from '@motovault/types';
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
import { BikePhotoField } from '../../components/onboarding/bike-setup/bike-photo-field';
import { BrandHero } from '../../components/onboarding/bike-setup/brand-hero';
import { MakeGrid } from '../../components/onboarding/bike-setup/make-grid';
import { ModelPicker } from '../../components/onboarding/bike-setup/model-picker';
import { VariantSelector } from '../../components/onboarding/bike-setup/variant-selector';
import { YearStepper } from '../../components/onboarding/bike-setup/year-stepper';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getBrandColor, getBrandDna, MAKE_COLORS, POPULAR_MAKES } from '../../config/brand-dna';
import { OB_SCREEN } from '../../config/onboarding';
import { useMileageUnit } from '../../hooks/use-mileage-unit';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext, useOnboardingStep } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { resolveMakeFromIntent } from '../../lib/pending-intent';
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
  if (
    /dr-z|drz|klx|crf|wr\d|xr\d|rally|tenere|versys|v-strom|vstrom|tiger|adventure|africa|gs\b|multistrada|africa twin/i.test(
      lower,
    )
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
  const onBack = useOnboardingBack(OB_SCREEN.BIKE_SETUP);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.BIKE_SETUP);
  const goNext = useOnboardingNext(OB_SCREEN.BIKE_SETUP);
  const insets = useSafeAreaInsets();
  const setBikeData = useOnboardingStore((s) => s.setBikeData);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);
  const existingBikeData = useOnboardingStore((s) => s.bikeData);
  // Web→app intent (P2). When set, bike-setup opens on a one-tap "Is this your
  // ride?" confirmation seeded from the article instead of the make grid.
  const pendingIntent = useOnboardingStore((s) => s.pendingIntent);
  const setPendingIntent = useOnboardingStore((s) => s.setPendingIntent);
  // Mileage captured on the (invested-flow) last-service step, which runs BEFORE
  // this screen. bike-setup has no mileage input of its own, so this is the only
  // place the rider enters it — fold it onto the bike here or it is lost.
  const preBikeMileage = useOnboardingStore((s) => s.preBikeMileage);
  const preBikeMileageUnit = useOnboardingStore((s) => s.preBikeMileageUnit);
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
  // Once the rider taps "Not my bike", drop the intent confirmation and fall
  // through to the normal grid for the rest of this screen's lifetime.
  const [dismissedIntent, setDismissedIntent] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(existingBikeData?.photoUri ?? null);
  // Minimal variant capture (U7) — null = "Not applicable" / baseline rows.
  const [variant, setVariant] = useState<MotorcycleVariant | null>(
    existingBikeData?.variant ?? null,
  );

  // ── Derived ─────────────────────────────────────────────────
  const yearNum = Number.parseInt(year, 10);
  const isValidYear = year.length === 4 && yearNum >= 1970 && yearNum <= currentYear + 1;
  const activeMakeName = isCustomMake ? customMakeName : selectedMake?.makeName;
  const hasMake = !!(selectedMake || (isCustomMake && customMakeName.trim()));
  const canContinue = isValidYear && hasMake;
  // Intent confirmation gate (P2 T3) — shown once the stored pendingIntent's make
  // has been resolved against the loaded make list (below) into `selectedMake`.
  const showIntentConfirm = !!pendingIntent && !dismissedIntent && !!selectedMake;

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
    if (showIntentConfirm) {
      return {
        lead: t('onboarding.v2IntentConfirmTitle' as never),
        accent: '',
        sub: t('onboarding.v2IntentConfirmSubtitle' as never),
      };
    }
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
  }, [showIntentConfirm, showBrandHero, activeMakeName, isCustomMake, t]);

  // ── Queries ─────────────────────────────────────────────────
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const makes = makesResult.data?.motorcycleMakes ?? [];

  // Resolve the web→app intent (P2 T3): once the make list has loaded, match the
  // stored pendingIntent's make and pre-fill the selection so the one-tap
  // confirmation shows. Resolving HERE (not in the reader) avoids a cold-start
  // fetch and reuses the list this screen already loads. An unknown make never
  // matches → the normal grid renders (fail-open). Skipped once the rider
  // diverges (dismissed the intent or picked their own make / custom).
  useEffect(() => {
    if (!pendingIntent || dismissedIntent || selectedMake || isCustomMake) return;
    if (makes.length === 0) return; // wait for the list before deciding a match
    const match = resolveMakeFromIntent(pendingIntent, makes);
    if (!match) {
      // Make couldn't be matched against the loaded list → the rider never gets
      // the "Is this your ride?" confirmation and picks their own bike. Invalidate
      // the intent so downstream cohort logic (maintenance auto-import, paywall
      // placement) never fires for a bike they didn't actually confirm.
      setPendingIntent(null);
      setDismissedIntent(true);
      return;
    }
    setSelectedMake({ makeId: match.makeId, makeName: match.makeName });
    if (pendingIntent.model) {
      setSelectedModel({ modelId: 0, modelName: pendingIntent.model });
    }
  }, [pendingIntent, dismissedIntent, selectedMake, isCustomMake, makes, setPendingIntent]);

  // First 4 popular makes (matched to real NHTSA make ids) for the partial-capture chips.
  const quickMakes = useMemo(() => {
    return POPULAR_MAKES.slice(0, 4)
      .map((name) => makes.find((m) => m.makeName.toLowerCase() === name.toLowerCase()) ?? null)
      .filter((m): m is (typeof makes)[number] => m !== null);
  }, [makes]);

  const makeStatsResult = useQuery({
    queryKey: queryKeys.makeStats.all,
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
      currentMileage: preBikeMileage ?? existingBikeData?.currentMileage ?? 0,
      mileageUnit: preBikeMileageUnit ?? existingBikeData?.mileageUnit ?? mileageUnit,
      ...(photoUri ? { photoUri } : {}),
      ...(variant ? { variant } : {}),
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
      prefilled_from_intent: showIntentConfirm,
    });

    goNext();
  };

  // "Not my bike" on the intent confirmation — clear the seeded intent + bike so
  // the rest of the flow behaves exactly like a normal, un-seeded onboarding.
  const handleNotMyBike = () => {
    triggerImpact();
    setPendingIntent(null);
    setBikeData(null);
    setDismissedIntent(true);
    handleChangeMake();
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
      currentMileage: preBikeMileage ?? existingBikeData?.currentMileage ?? 0,
      mileageUnit: preBikeMileageUnit ?? existingBikeData?.mileageUnit ?? mileageUnit,
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
            label={t(
              (showIntentConfirm
                ? 'onboarding.v2IntentConfirmEyebrow'
                : 'onboarding.v2BikeSetupEyebrow') as never,
            )}
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
              {headline.accent ? (
                <>
                  {'\n'}
                  <Text
                    style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}
                  >
                    {headline.accent}
                  </Text>
                </>
              ) : null}
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
          {showIntentConfirm && selectedMake ? (
            /* ═══ Intent confirmation: one-tap "Is this your ride?" (P2 T3) ═══ */
            <IntentConfirmCard
              makeName={selectedMake.makeName}
              modelName={selectedModel?.modelName ?? null}
              year={year}
              onYearChange={setYear}
              onStep={triggerImpact}
              accent={getBrandColor(selectedMake.makeName)}
            />
          ) : !showMakeDetails ? (
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

                  {/* Variant capture (U7) — only once a specific model is chosen;
                      it's meaningless at the make level. */}
                  {selectedModel && (
                    <VariantSelector
                      value={variant}
                      onChange={setVariant}
                      accent={getBrandColor(activeMakeName)}
                    />
                  )}

                  <BikePhotoField
                    photoUri={photoUri}
                    onChange={setPhotoUri}
                    accent={getBrandColor(activeMakeName)}
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
          {showIntentConfirm ? (
            /* ═══ Intent confirmation actions (P2 T3) ═══ */
            <>
              <OnboardingContinueButton
                label={t('onboarding.v2IntentConfirmCta' as never)}
                onPress={handleContinue}
                disabled={!canContinue}
              />
              <Pressable
                onPress={handleNotMyBike}
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.v2IntentConfirmChange' as never)}
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
                  {t('onboarding.v2IntentConfirmChange' as never)}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
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
                    accessibilityLabel={t('onboarding.v2BikeSetupSkip')}
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
                accessibilityLabel={
                  showMakeDetails
                    ? t('onboarding.v2BikeSetupSkip')
                    : t('onboarding.v2BikeSetupNotSure' as never)
                }
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
            </>
          )}
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

/**
 * Intent confirmation (P2 T3) — a single identity card for the bike carried over
 * from the article, plus the year stepper (the only required input). Confirming
 * runs the normal handleContinue; "Not my bike" drops back to the grid.
 */
function IntentConfirmCard({
  makeName,
  modelName,
  year,
  onYearChange,
  onStep,
  accent,
}: {
  makeName: string;
  modelName: string | null;
  year: string;
  onYearChange: (year: string) => void;
  onStep: () => void;
  accent: string;
}) {
  const bikeLabel = modelName ? `${makeName} ${modelName}` : makeName;
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ gap: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          borderRadius: 18,
          borderCurve: 'continuous',
          backgroundColor: ONBOARDING_COLORS.surfaceCardTranslucent,
          borderWidth: 1,
          borderColor: `${accent}4D`,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            borderCurve: 'continuous',
            backgroundColor: MAKE_COLORS[makeName] ?? accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: ONBOARDING_COLORS.textWhite }}>
            {makeName[0]}
          </Text>
        </View>
        <Text
          style={{
            flex: 1,
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 26,
            lineHeight: 30,
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.4,
          }}
        >
          {bikeLabel}
        </Text>
      </View>

      <YearStepper value={year} onChange={onYearChange} onStep={onStep} />
    </Animated.View>
  );
}

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
