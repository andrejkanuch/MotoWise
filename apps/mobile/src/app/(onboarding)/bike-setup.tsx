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
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BikePhotoField } from '../../components/onboarding/bike-setup/bike-photo-field';
import { MakeGrid } from '../../components/onboarding/bike-setup/make-grid';
import { ModelPicker } from '../../components/onboarding/bike-setup/model-picker';
import { MakeBadge, PickerLabel } from '../../components/onboarding/bike-setup/picker-ui';
import { VariantSelector } from '../../components/onboarding/bike-setup/variant-selector';
import { YearStepper } from '../../components/onboarding/bike-setup/year-stepper';
import { OnboardingBikePlate } from '../../components/onboarding/onboarding-bike-plate';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import {
  OnboardingShell,
  OnboardingTextButton,
} from '../../components/onboarding/onboarding-shell';
import { getBrandDna, MAKE_COLORS, POPULAR_MAKES } from '../../config/brand-dna';
import { OB_SCREEN } from '../../config/onboarding';
import { useMileageUnit } from '../../hooks/use-mileage-unit';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { resolveMakeFromIntent } from '../../lib/pending-intent';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
import { isValidMakeName } from '../../utils/bike-make';
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
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const onBack = useOnboardingBack(OB_SCREEN.BIKE_SETUP);
  const goNext = useOnboardingNext(OB_SCREEN.BIKE_SETUP);
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
  const activeMakeName = isCustomMake ? customMakeName.trim() : selectedMake?.makeName;
  // Intent confirmation gate (P2 T3) — shown once the stored pendingIntent's make
  // has been resolved against the loaded make list (below) into `selectedMake`.
  const showIntentConfirm = !!pendingIntent && !dismissedIntent && !!selectedMake;

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.BIKE_SETUP);
  }, []);

  // ── Queries ─────────────────────────────────────────────────
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const makesData = makesResult.data?.motorcycleMakes;
  const makes = useMemo(() => makesData ?? [], [makesData]);

  // A picked make is real by construction; a free-typed one must pass the
  // length/list check so 1–2 character junk ("H", "ab") can't become a bike.
  const makeNames = useMemo(() => makes.map((m) => m.makeName), [makes]);
  const isCustomMakeValid = isCustomMake && isValidMakeName(customMakeName, makeNames);
  const hasMake = !!selectedMake || isCustomMakeValid;
  const canContinue = isValidYear && hasMake;

  // ── Stage: make selected vs not ─────────────────────────────
  // Leave the grid (Stage A) once a make is picked OR "Other make" is tapped —
  // the latter reveals the custom-name input even before a name is typed.
  const showMakeDetails = !!selectedMake || isCustomMake;
  // Brand hero/headline only once we actually have a valid name to show.
  const showBrandHero = hasMake;

  // ── Dynamic headline + reward subtitle (empty → picked) ─────
  const headline = useMemo(() => {
    if (showIntentConfirm) {
      return {
        title: t('onboarding.v2IntentConfirmTitle' as never),
        sub: t('onboarding.v2IntentConfirmSubtitle' as never),
      };
    }
    if (showBrandHero && activeMakeName) {
      return {
        title: t('onboarding.v2BikeSetupTitlePickedFull' as never, {
          makeName: activeMakeName,
        }) as string,
        sub: isCustomMake
          ? t('onboarding.v2BikeSetupSubtitleReward' as never)
          : (getBrandDna(activeMakeName)?.tagline ??
            t('onboarding.v2BikeSetupSubtitleReward' as never)),
      };
    }
    return {
      title: t('onboarding.v2BikeSetupTitleEmptyFull' as never),
      sub: t('onboarding.v2BikeSetupSubtitleReward' as never),
    };
  }, [showIntentConfirm, showBrandHero, activeMakeName, isCustomMake, t]);

  // Resolve the web→app intent (P2 T3): once the make list has loaded, match the
  // stored pendingIntent's make and pre-fill the selection so the one-tap
  // confirmation shows. Resolving HERE (not in the reader) avoids a cold-start
  // fetch and reuses the list this screen already loads. An unknown make never
  // matches → the normal grid renders (fail-open). Skipped once the rider
  // diverges (dismissed the intent or picked their own make / custom).
  useEffect(() => {
    if (!pendingIntent || dismissedIntent || selectedMake || isCustomMake) return;
    // Only wait while the list is genuinely loading — once the query settles
    // (including error / empty result) we must decide, or an errored makes query
    // would leave the intent active forever.
    if (makesResult.isPending) return;
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
  }, [
    pendingIntent,
    dismissedIntent,
    selectedMake,
    isCustomMake,
    makes,
    makesResult.isPending,
    setPendingIntent,
  ]);

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

  const makeStat = activeMakeName
    ? makeStats.find((st) => st.make.toLowerCase() === activeMakeName.toLowerCase())
    : undefined;

  // ── Footer ──────────────────────────────────────────────────
  const footerSecondary = showIntentConfirm
    ? {
        label: t('onboarding.v2IntentConfirmChange' as never),
        onPress: handleNotMyBike,
      }
    : {
        label: showMakeDetails
          ? t('onboarding.v2BikeSetupSkip')
          : t('onboarding.v2BikeSetupNotSure' as never),
        // With a make picked / custom entry open, the footer is a true skip.
        // In the empty list it reveals the make-only partial-capture chips.
        onPress: () => {
          if (showMakeDetails) {
            handleSkip();
          } else {
            triggerImpact();
            setShowPartialCapture((v) => !v);
          }
        },
      };

  const partialCapture =
    !showIntentConfirm && !showMakeDetails && showPartialCapture && quickMakes.length > 0 ? (
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          marginBottom: space.xs,
          padding: space.md,
          gap: space.sm,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: oc.surface,
        }}
      >
        <Text style={[type.subhead, { color: oc.textSecondary }]}>
          {t('onboarding.v2BikeSetupPartialHelper' as never)}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {quickMakes.map((m) => (
            <Pressable
              key={m.makeId}
              onPress={() => handleQuickMake(m)}
              accessibilityRole="button"
              accessibilityLabel={m.makeName}
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                paddingHorizontal: space.sm,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                backgroundColor: oc.surface2,
              }}
            >
              <MakeBadge makeName={m.makeName} color={MAKE_COLORS[m.makeName]} />
              <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>{m.makeName}</Text>
            </Pressable>
          ))}
        </View>
        {/* True skip — no bike, keeps existing handleSkip navigation. */}
        <Pressable
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding.v2BikeSetupSkip')}
          style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={[type.bodyStrong, { color: oc.warm2 }]}>
            {t('onboarding.v2BikeSetupSkip')}
          </Text>
        </Pressable>
      </Animated.View>
    ) : null;

  return (
    <OnboardingShell
      screen={OB_SCREEN.BIKE_SETUP}
      onBack={onBack}
      title={headline.title}
      subtitle={headline.sub}
      footer={partialCapture}
      primary={{
        label: showIntentConfirm
          ? t('onboarding.v2IntentConfirmCta' as never)
          : t('onboarding.v2BikeSetupCta' as never),
        onPress: handleContinue,
        disabled: !canContinue,
      }}
      secondary={footerSecondary}
      contentStyle={{ gap: space.xl }}
    >
      {showIntentConfirm && selectedMake ? (
        /* ═══ Intent confirmation: one-tap "Is this your ride?" (P2 T3) ═══ */
        <>
          <OnboardingBikePlate
            make={selectedMake.makeName}
            model={selectedModel?.modelName}
            year={isValidYear ? yearNum : null}
          />
          <YearStepper value={year} onChange={setYear} onStep={triggerImpact} />
        </>
      ) : !showMakeDetails ? (
        /* ═══ Stage A: make list (year is set after a make is picked) ═══ */
        <MakeGrid
          makes={makes}
          stats={makeStats}
          onSelect={handleSelectMake}
          onSelectOther={handleSelectOther}
        />
      ) : (
        /* ═══ Stage B: the bike becomes a plate, then model / year / extras ═══ */
        <>
          {showBrandHero && activeMakeName ? (
            <View style={{ gap: space.xs }}>
              <OnboardingBikePlate
                make={activeMakeName}
                model={selectedModel?.modelName}
                year={isValidYear ? yearNum : null}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.subhead, { flex: 1, color: oc.textSecondary }]}>
                  {isCustomMake
                    ? t('onboarding.v2BrandHeroWelcomeCustom')
                    : makeStat && makeStat.riders > 0
                      ? t('onboarding.v2BrandHeroWelcomeRiders', {
                          count: makeStat.riders + 1,
                          makeName: activeMakeName,
                        })
                      : t('onboarding.v2BrandHeroWelcomeGeneric', { makeName: activeMakeName })}
                </Text>
                <OnboardingTextButton
                  label={t('onboarding.v2BrandHeroChange')}
                  onPress={handleChangeMake}
                />
              </View>
            </View>
          ) : null}

          {/* Custom make name input (only for "Other"). Stays mounted while
              typing — it used to unmount after the first character. */}
          {isCustomMake && (
            <View>
              <PickerLabel>{t('onboarding.v2BikeSetupMakeName')}</PickerLabel>
              <TextInput
                value={customMakeName}
                onChangeText={setCustomMakeName}
                placeholder={t('onboarding.v2BikeSetupMakeNamePlaceholder')}
                placeholderTextColor={oc.textMuted}
                accessibilityLabel={t('onboarding.v2BikeSetupMakeName')}
                autoCapitalize="words"
                maxLength={50}
                autoFocus
                selectionColor={oc.warm}
                style={[
                  type.body,
                  {
                    minHeight: 52,
                    paddingHorizontal: space.md,
                    borderRadius: radius.control,
                    borderCurve: 'continuous',
                    backgroundColor: oc.surface,
                    color: oc.textPrimary,
                  },
                ]}
              />
            </View>
          )}

          {showBrandHero && activeMakeName && (
            <ModelPicker
              makeName={activeMakeName}
              isCustomMake={isCustomMake}
              models={models}
              isLoading={modelsResult.isLoading}
              selectedModel={selectedModel}
              onSelect={handleSelectModel}
              onDismiss={() => setSelectedModel(null)}
            />
          )}

          {/* Model year stepper */}
          <YearStepper value={year} onChange={setYear} onStep={triggerImpact} />

          {showBrandHero && activeMakeName && (
            <>
              {/* Variant capture (U7) — only once a specific model is chosen;
                  it's meaningless at the make level. */}
              {selectedModel && <VariantSelector value={variant} onChange={setVariant} />}
              <BikePhotoField photoUri={photoUri} onChange={setPhotoUri} />
            </>
          )}
        </>
      )}
    </OnboardingShell>
  );
}
