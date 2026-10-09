import { GetOnboardingRevealDocument, type GetOnboardingRevealQuery } from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { DollarSign, Lightbulb, ShieldCheck, Users, Wrench } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingBackButton } from '../../components/onboarding/onboarding-back-button';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { BikePlate, PLATE_SIZE, PLATE_STATE } from '../../components/ui/bike-plate';
import { getBikeImage } from '../../config/bike-images';
import { getBrandDna } from '../../config/brand-dna';
import { getPrimaryConcern, OB_SCREEN, OB_VARIANT } from '../../config/onboarding';
import { useOnboardingBack } from '../../hooks/use-onboarding-back';
import {
  useOnboardingNext,
  useOnboardingStep,
  useOnboardingVariant,
} from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { queryKeys } from '../../lib/query-keys';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
import { getRevealRiderCount } from '../../utils/onboarding-reveal';

type RevealData = GetOnboardingRevealQuery['onboardingReveal'];

const NO_VALUE = '—';

/** Split a brand-DNA interval ("10,000 km") into the plate's figure and unit. */
function splitInterval(interval: string | undefined): { figure: string; unit?: string } {
  if (!interval) return { figure: NO_VALUE };
  const at = interval.lastIndexOf(' ');
  return at > 0
    ? { figure: interval.slice(0, at), unit: interval.slice(at + 1) }
    : { figure: interval };
}

/** Archetype → Category spec-tile i18n key (falls back to "Tracked"). */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  adv: 'obRevealCatAdventure',
  sport: 'obRevealCatSport',
  cruiser: 'obRevealCatCruiser',
};

/**
 * The bike's actual type → archetype. Preferred over the brand archetype, which
 * is brand-wide and wrong for multi-segment makes (e.g. Honda is tagged "sport"
 * but the Africa Twin is an adventure bike). Unmapped types fall back to brand.
 */
const TYPE_TO_ARCHETYPE: Partial<Record<MotorcycleType, string>> = {
  [MotorcycleType.SPORTBIKE]: 'sport',
  [MotorcycleType.DUAL_SPORT]: 'adv',
  [MotorcycleType.DIRT_BIKE]: 'adv',
  [MotorcycleType.CRUISER]: 'cruiser',
};

export default function RevealScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const variant = useOnboardingVariant();
  const onBack = useOnboardingBack(OB_SCREEN.REVEAL);
  const { stepIndex, totalScreens } = useOnboardingStep(OB_SCREEN.REVEAL);
  const goNext = useOnboardingNext(OB_SCREEN.REVEAL);
  const bikeData = useOnboardingStore((s) => s.bikeData);
  const stayOnTopOf = useOnboardingStore((s) => s.stayOnTopOf);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  // B biases the Reveal's lead emphasis to the rider's top concern.
  const primaryConcern = getPrimaryConcern(stayOnTopOf);

  const make = bikeData?.make ?? '';
  const model = bikeData?.model || undefined;
  const year = bikeData?.year ?? new Date().getFullYear() - 3;
  const dna = getBrandDna(make);
  // Prefer the bike's detected type; fall back to the brand archetype.
  const archetype = (bikeData?.type && TYPE_TO_ARCHETYPE[bikeData.type]) || dna?.type || '';
  const categoryLabel = t(
    `onboarding.${CATEGORY_LABEL_KEYS[archetype] ?? 'obRevealCatTracked'}` as never,
  ) as string;

  // Variant B leads with the cost projection; A leads with the recall check.
  const projectionLed = variant === OB_VARIANT.INVESTED;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.onboarding.reveal(make, year, model),
    queryFn: () => gqlFetcher(GetOnboardingRevealDocument, { make, year, model }),
    enabled: !!make,
    staleTime: 5 * 60 * 1000,
  });

  const reveal: RevealData | undefined = data?.onboardingReveal;
  const insightsReady =
    reveal?.insights.status === 'ready' && reveal.insights.knownIssues.length > 0;

  useEffect(() => {
    setLastCompletedScreen(OB_SCREEN.REVEAL);
  }, [setLastCompletedScreen]);

  // Fire reveal_viewed once the data settles (carries what was actually shown).
  useEffect(() => {
    if (isPending) return;
    trackOnboardingEvent(AnalyticsEvent.REVEAL_VIEWED, OB_SCREEN.REVEAL, {
      recall_count: reveal?.recallCount ?? 0,
      recalls_checked: reveal?.recallsChecked ?? false,
      has_projection: reveal?.projectedYearlyCostEur != null,
      has_known_issues: insightsReady,
      projection_led: projectionLed,
    });
  }, [isPending, reveal, insightsReady, projectionLed]);

  const riderCount = getRevealRiderCount(reveal?.riderCount);

  // ── proof blocks, ordered by variant ─────────────────────────────
  const costProof =
    projectionLed && reveal?.projectedYearlyCostEur != null ? (
      <Animated.View
        key="cost"
        entering={FadeInUp.delay(240).duration(280)}
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          padding: space.md,
          backgroundColor: oc.surface,
          gap: space.xs,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <ProofIcon>
            <DollarSign size={18} color={oc.textSecondary} />
          </ProofIcon>
          <Text style={[type.label, { color: oc.textMuted }]}>
            {t('onboarding.obRevealFirstYear')}
          </Text>
        </View>
        <Text style={[type.sectionTitle, { color: oc.textPrimary }]}>
          {t('onboarding.obRevealCostAbout')} €{reveal.projectedYearlyCostEur}{' '}
          {t('onboarding.obRevealCostInService')}
        </Text>
        <Text style={[type.subhead, { color: oc.textSecondary }]}>
          {t('onboarding.obRevealCostHint')}
        </Text>
      </Animated.View>
    ) : null;

  const recallProof = (
    <Animated.View
      key="recall"
      entering={FadeInUp.delay(300).duration(280)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}
    >
      <ProofIcon>
        <ShieldCheck size={18} color={oc.success} />
      </ProofIcon>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
          {reveal?.recallsChecked
            ? t('onboarding.obRevealRecallsClear', {
                count: reveal.recallCount,
                year,
                make,
                model: model ?? '',
              })
            : t('onboarding.obRevealRecallsWatch', { make })}
        </Text>
        <Text style={[type.caption, { color: oc.textMuted }]}>
          {t('onboarding.obRevealRecallsSource')}
        </Text>
      </View>
    </Animated.View>
  );

  const knownIssuesProof = insightsReady ? (
    <Animated.View
      key="issues"
      entering={FadeInUp.delay(360).duration(280)}
      style={{
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: space.md,
        backgroundColor: oc.surface,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <ProofIcon>
          <Lightbulb size={18} color={oc.warning} />
        </ProofIcon>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: oc.textPrimary }]}>
            {t('onboarding.obRevealKnownIssuesTitle', { label: model || make })}
          </Text>
          <Text style={[type.caption, { color: oc.textMuted }]}>
            {t('onboarding.obRevealKnownIssuesTag')}
          </Text>
        </View>
      </View>
      <View style={{ gap: space.xs }}>
        {reveal.insights.knownIssues.map((issue) => (
          <View
            key={issue.title}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xs }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: radius.pill,
                backgroundColor: oc.warning,
                marginTop: 8,
              }}
            />
            <Text style={[type.subhead, { flex: 1, color: oc.textSecondary }]}>{issue.detail}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  ) : null;

  const communityProof =
    riderCount != null ? (
      <Animated.View
        key="community"
        entering={FadeInUp.delay(450).duration(280)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
      >
        <ProofIcon>
          <Users size={18} color={oc.textSecondary} />
        </ProofIcon>
        <Text style={[type.subhead, { flex: 1, color: oc.textSecondary }]}>
          {t('onboarding.obRevealCommunity', { count: riderCount, make })}
        </Text>
      </Animated.View>
    ) : null;

  const scheduleProof = (
    <Animated.View
      key="schedule"
      entering={FadeInUp.delay(400).duration(280)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
    >
      <ProofIcon>
        <Wrench size={18} color={oc.textSecondary} />
      </ProofIcon>
      <Text style={[type.subhead, { flex: 1, color: oc.textSecondary }]}>
        {t('onboarding.obRevealScheduleProof')}
      </Text>
    </Animated.View>
  );

  // Card order. A always leads with the recall check. B leads with the cost
  // projection, then biases the second slot to the rider's primary concern:
  // an "issues"-led rider sees the AI known-issues card promoted directly
  // under the projection (A's order already places issues second).
  let proofs: ReactNode[];
  if (!projectionLed) {
    proofs = [recallProof, scheduleProof, knownIssuesProof, communityProof];
  } else if (primaryConcern === 'catch_issues_early') {
    proofs = [costProof, knownIssuesProof, recallProof, scheduleProof, communityProof];
  } else {
    proofs = [costProof, recallProof, scheduleProof, knownIssuesProof, communityProof];
  }

  // The rider's first plate: a new bike in the garage starts "ready", and its
  // figure is the make's service interval.
  const interval = splitInterval(dna?.serviceInterval);
  const identity = [make, model].filter(Boolean).join(' ');

  return (
    <View style={{ flex: 1, backgroundColor: oc.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <OnboardingBackButton
        onPress={onBack}
        style={{ position: 'absolute', top: insets.top + 40, left: space.md, zIndex: 10 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: 72 + space.md,
          paddingBottom: 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text
          entering={FadeInUp.duration(280)}
          accessibilityRole="header"
          style={[type.largeTitle, { color: oc.textPrimary, marginBottom: space.lg }]}
        >
          {projectionLed
            ? t('onboarding.obRevealTitleBFull', { year, make })
            : t('onboarding.obRevealTitleAFull')}
        </Animated.Text>

        {/* bike photo — rider's own if they added one, else stock per-make */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(280)}
          style={{
            height: 132,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: oc.surface,
            marginBottom: space.sm,
          }}
        >
          <Image
            source={bikeData?.photoUri ? { uri: bikeData.photoUri } : getBikeImage(make)}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={250}
          />
          <LinearGradient
            colors={['transparent', oc.surfaceOverlayMedium]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 }}
          />
        </Animated.View>

        {/* The signature object — the rider meets their bike's plate here. */}
        <BikePlate
          state={PLATE_STATE.READY}
          size={PLATE_SIZE.HERO}
          figure={interval.figure}
          unit={interval.unit}
          caption={t('onboarding.obRevealSpecInterval')}
          stateLabel={t('home.readyLabel')}
          identity={`${identity} · ${year}`}
          accessibilityLabel={`${identity} ${year}, ${t('onboarding.obRevealSpecInterval')} ${interval.figure} ${interval.unit ?? ''}`}
        />

        {/* Bike facts — inset grouped rows */}
        <View
          style={{
            marginTop: space.sm,
            marginBottom: space.xl,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: oc.surface,
            overflow: 'hidden',
          }}
        >
          <FactRow
            label={t('onboarding.obRevealSpecRecalls')}
            value={String(reveal?.recallCount ?? 0)}
            numeric
          />
          <View style={{ height: 1, marginLeft: space.md, backgroundColor: oc.line }} />
          <FactRow label={t('onboarding.obRevealSpecCategory')} value={categoryLabel} />
        </View>

        <View style={{ gap: space.md, marginBottom: space.lg }}>{proofs.filter(Boolean)}</View>

        <Text style={[type.subhead, { color: oc.textMuted }]}>
          {t('onboarding.obRevealClosing')}
        </Text>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
          paddingBottom: insets.bottom + space.md,
          backgroundColor: oc.background,
        }}
      >
        <OnboardingContinueButton label={t('onboarding.continue')} onPress={goNext} />
      </View>
    </View>
  );
}

function ProofIcon({ children }: { children: ReactNode }) {
  const oc = useOnboardingColors();
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.control,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: oc.surface2,
      }}
    >
      {children}
    </View>
  );
}

function FactRow({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  const oc = useOnboardingColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 48,
        paddingHorizontal: space.md,
        gap: space.sm,
      }}
    >
      <Text style={[type.body, { color: oc.textSecondary }]}>{label}</Text>
      <Text style={[numeric ? type.figureSmall : type.bodyStrong, { color: oc.textPrimary }]}>
        {value}
      </Text>
    </View>
  );
}
