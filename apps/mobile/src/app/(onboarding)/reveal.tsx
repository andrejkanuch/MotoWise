import { GetOnboardingRevealDocument, type GetOnboardingRevealQuery } from '@motovault/graphql';
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
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingContinueButton } from '../../components/onboarding/onboarding-continue-button';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { getBikeImage } from '../../config/bike-images';
import { getBrandColor, getBrandDna } from '../../config/brand-dna';
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

type RevealData = GetOnboardingRevealQuery['onboardingReveal'];

/** Brand archetype → Category spec-tile i18n key (falls back to "Tracked"). */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  adv: 'obRevealCatAdventure',
  sport: 'obRevealCatSport',
  cruiser: 'obRevealCatCruiser',
};

export default function RevealScreen() {
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
  const brandColor = getBrandColor(make);
  const dna = getBrandDna(make);
  const categoryLabel = t(
    `onboarding.${CATEGORY_LABEL_KEYS[dna?.type ?? ''] ?? 'obRevealCatTracked'}` as never,
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

  const riderCount = reveal?.riderCount && reveal.riderCount > 0 ? reveal.riderCount : 9;

  // ── proof blocks, ordered by variant ─────────────────────────────
  const costProof =
    projectionLed && reveal?.projectedYearlyCostEur != null ? (
      <Animated.View
        key="cost"
        entering={FadeInUp.delay(240).duration(360)}
        style={{
          borderRadius: 18,
          borderCurve: 'continuous',
          padding: 16,
          backgroundColor: ONBOARDING_COLORS.accentBg,
          borderWidth: 1,
          borderColor: ONBOARDING_COLORS.warm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <ProofIcon color={ONBOARDING_COLORS.warm2}>
            <DollarSign size={19} color={ONBOARDING_COLORS.warm2} />
          </ProofIcon>
          <Text style={monoLabel}>{t('onboarding.obRevealFirstYear')}</Text>
        </View>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 28,
            lineHeight: 30,
            color: ONBOARDING_COLORS.textPrimary,
          }}
        >
          {t('onboarding.obRevealCostAbout')}{' '}
          <Text style={{ color: ONBOARDING_COLORS.warm2 }}>€{reveal.projectedYearlyCostEur}</Text>{' '}
          {t('onboarding.obRevealCostInService')}
        </Text>
        <Text
          style={{
            fontSize: 12.5,
            color: ONBOARDING_COLORS.textSecondary,
            lineHeight: 18,
            marginTop: 8,
          }}
        >
          {t('onboarding.obRevealCostHint')}
        </Text>
      </Animated.View>
    ) : null;

  const recallProof = (
    <Animated.View
      key="recall"
      entering={FadeInUp.delay(330).duration(360)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 13 }}
    >
      <ProofIcon color={ONBOARDING_COLORS.success}>
        <ShieldCheck size={18} color={ONBOARDING_COLORS.success} />
      </ProofIcon>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: ONBOARDING_COLORS.textPrimary,
            lineHeight: 19,
          }}
        >
          {reveal?.recallsChecked
            ? t('onboarding.obRevealRecallsClear', {
                count: reveal.recallCount,
                year,
                make,
                model: model ?? '',
              })
            : t('onboarding.obRevealRecallsWatch', { make })}
        </Text>
        <Text
          style={{ fontSize: 12.5, color: ONBOARDING_COLORS.ink3, lineHeight: 17, marginTop: 3 }}
        >
          {t('onboarding.obRevealRecallsSource')}
        </Text>
      </View>
    </Animated.View>
  );

  const knownIssuesProof = insightsReady ? (
    <Animated.View
      key="issues"
      entering={FadeInUp.delay(420).duration(360)}
      style={{
        borderRadius: 18,
        borderCurve: 'continuous',
        padding: 15,
        backgroundColor: ONBOARDING_COLORS.cardBg,
        borderWidth: 1,
        borderColor: ONBOARDING_COLORS.cardBorderDefault,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 11 }}>
        <ProofIcon color={ONBOARDING_COLORS.warning} size={34}>
          <Lightbulb size={17} color={ONBOARDING_COLORS.warning} />
        </ProofIcon>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: ONBOARDING_COLORS.textPrimary }}>
            {t('onboarding.obRevealKnownIssuesTitle', { label: model || make })}
          </Text>
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 8.5,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.textMuted,
              marginTop: 2,
            }}
          >
            {t('onboarding.obRevealKnownIssuesTag')}
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        {reveal.insights.knownIssues.map((issue) => (
          <View
            key={issue.title}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: ONBOARDING_COLORS.warning,
                marginTop: 7,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: 12.5,
                color: ONBOARDING_COLORS.textSecondary,
                lineHeight: 18,
              }}
            >
              {issue.detail}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  ) : null;

  const communityProof = (
    <Animated.View
      key="community"
      entering={FadeInUp.delay(510).duration(360)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}
    >
      <ProofIcon color={ONBOARDING_COLORS.accentBlue}>
        <Users size={18} color={ONBOARDING_COLORS.accentBlue} />
      </ProofIcon>
      <Text
        style={{ flex: 1, fontSize: 13.5, color: ONBOARDING_COLORS.textSecondary, lineHeight: 19 }}
      >
        {t('onboarding.obRevealCommunity', { count: riderCount, make })}
      </Text>
    </Animated.View>
  );

  const scheduleProof = (
    <Animated.View
      key="schedule"
      entering={FadeInUp.delay(465).duration(360)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}
    >
      <ProofIcon color={brandColor}>
        <Wrench size={18} color={brandColor} />
      </ProofIcon>
      <Text
        style={{ flex: 1, fontSize: 13.5, color: ONBOARDING_COLORS.textSecondary, lineHeight: 19 }}
      >
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

  return (
    <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
      <OnboardingProgress screenIndex={stepIndex} totalScreens={totalScreens} />

      <OnboardingBackButton
        onPress={onBack}
        style={{ position: 'absolute', top: insets.top + 44, left: 16, zIndex: 10 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 72, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* GARAGE UNLOCKED badge */}
        <Animated.View
          entering={FadeInUp.duration(320)}
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 5,
            paddingHorizontal: 11,
            borderRadius: 999,
            borderCurve: 'continuous',
            backgroundColor: ONBOARDING_COLORS.accentBg,
            borderWidth: 1,
            borderColor: ONBOARDING_COLORS.warm,
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 10,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: ONBOARDING_COLORS.warm2,
            }}
          >
            {t('onboarding.obRevealBadge')}
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInUp.delay(70).duration(320)}
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 34,
            lineHeight: 36,
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.7,
            marginBottom: 16,
          }}
        >
          {projectionLed ? t('onboarding.obRevealTitleB') : t('onboarding.obRevealTitleA')}{' '}
          <Text style={{ fontFamily: 'InstrumentSerif-Italic', color: ONBOARDING_COLORS.warm2 }}>
            {projectionLed
              ? t('onboarding.obRevealTitleBItalic', { year, make })
              : t('onboarding.obRevealTitleAItalic')}
          </Text>
        </Animated.Text>

        {/* Bike hero card */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(380)}
          style={{
            borderRadius: 20,
            borderCurve: 'continuous',
            overflow: 'hidden',
            marginBottom: 18,
            backgroundColor: ONBOARDING_COLORS.surface,
            borderWidth: 1,
            borderColor: `${brandColor}55`,
            shadowColor: brandColor,
            shadowOpacity: 0.2,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 14 },
            elevation: 8,
          }}
        >
          {/* bike hero photo — rider's own if they added one, else stock per-make */}
          <View style={{ height: 132 }}>
            <Image
              source={bikeData?.photoUri ? { uri: bikeData.photoUri } : getBikeImage(make)}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={250}
            />
            <LinearGradient
              colors={['transparent', `${brandColor}1F`, ONBOARDING_COLORS.surface]}
              locations={[0, 0.5, 1]}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 96 }}
            />
            <View
              style={{
                position: 'absolute',
                left: 16,
                bottom: 12,
                width: 44,
                height: 44,
                borderRadius: 13,
                borderCurve: 'continuous',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: brandColor,
                shadowColor: brandColor,
                shadowOpacity: 0.5,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: '800', color: ONBOARDING_COLORS.textWhite }}>
                {make.charAt(0).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={{ padding: 18 }}>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 10,
                letterSpacing: 1.4,
                color: ONBOARDING_COLORS.ink3,
              }}
            >
              {year}
            </Text>
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 26,
                lineHeight: 28,
                color: ONBOARDING_COLORS.textPrimary,
              }}
            >
              {make}
              {model ? <Text style={{ color: ONBOARDING_COLORS.warm2 }}> {model}</Text> : null}
            </Text>

            {/* spec tiles */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <SpecTile
                value={dna?.serviceInterval ?? '—'}
                label={t('onboarding.obRevealSpecInterval')}
                color={brandColor}
              />
              <SpecTile
                value={String(reveal?.recallCount ?? 0)}
                label={t('onboarding.obRevealSpecRecalls')}
                color={brandColor}
              />
              <SpecTile
                value={categoryLabel}
                label={t('onboarding.obRevealSpecCategory')}
                color={brandColor}
              />
            </View>
          </View>
        </Animated.View>

        <View style={{ gap: 12, marginBottom: 14 }}>{proofs.filter(Boolean)}</View>

        <Text
          style={{
            fontSize: 12.5,
            fontStyle: 'italic',
            color: ONBOARDING_COLORS.ink3,
            lineHeight: 18,
          }}
        >
          {t('onboarding.obRevealClosing')}
        </Text>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 22,
          paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: ONBOARDING_COLORS.background,
        }}
      >
        <OnboardingContinueButton label={t('onboarding.continue')} onPress={goNext} />
      </View>
    </View>
  );
}

const monoLabel = {
  fontFamily: 'GeistMono-Medium',
  fontSize: 10,
  letterSpacing: 1.6,
  textTransform: 'uppercase' as const,
  color: ONBOARDING_COLORS.ink3,
};

function ProofIcon({
  children,
  color,
  size = 38,
}: {
  children: React.ReactNode;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${color}26`,
      }}
    >
      {children}
    </View>
  );
}

function SpecTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        padding: 11,
        borderRadius: 13,
        borderCurve: 'continuous',
        backgroundColor: ONBOARDING_COLORS.surfaceOverlayMedium,
        borderWidth: 1,
        borderColor: ONBOARDING_COLORS.line,
      }}
    >
      <Text style={{ fontFamily: 'GeistMono-Medium', fontSize: 13, fontWeight: '600', color }}>
        {value}
      </Text>
      <Text
        style={{
          fontFamily: 'GeistMono-Medium',
          fontSize: 8,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: ONBOARDING_COLORS.ink3,
          marginTop: 6,
          lineHeight: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
