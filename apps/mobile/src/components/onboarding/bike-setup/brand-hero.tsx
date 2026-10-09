import type { MakeStatsQuery } from '@motovault/graphql';
import { RefreshCw } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { type BrandInfo, getBrandColor, getBrandDna } from '../../../config/brand-dna';
import { radius, space, type } from '../../../theme/type';
import { useOnboardingColors } from '../onboarding-colors';

type MakeStat = MakeStatsQuery['makeStats'][number];

interface BrandHeroProps {
  makeName: string;
  isCustom: boolean;
  stats: MakeStat[];
  onChangeMake: () => void;
}

function PopularityBadge({ stat }: { stat: MakeStat }) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const label =
    stat.rank === 1
      ? t('onboarding.v2BrandHeroMostPopular')
      : stat.rank <= 3
        ? t('onboarding.v2BrandHeroTop3')
        : stat.rank <= 8
          ? t('onboarding.v2BrandHeroPopular')
          : null;
  if (!label) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(300).duration(380)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: space.xxs,
        paddingHorizontal: space.xs,
        borderRadius: radius.pill,
        backgroundColor: oc.surface2,
        marginBottom: space.xs,
      }}
    >
      <Text style={[type.caption, { color: oc.textSecondary }]}>
        {label}
        {stat.riders > 0 && ` · ${t('onboarding.v2BrandHeroRiders', { count: stat.riders })}`}
      </Text>
    </Animated.View>
  );
}

function StatsRow({
  brandDna,
  stat,
  isCustom,
}: {
  brandDna: BrandInfo | null;
  stat: MakeStat | undefined;
  isCustom: boolean;
}) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const cells = useMemo(() => {
    const result: { big: string; label: string }[] = [];
    // Service interval — from manufacturer spec (always available for known brands)
    if (brandDna?.serviceInterval) {
      result.push({
        big: brandDna.serviceInterval,
        label: t('onboarding.v2BrandHeroServiceInterval'),
      });
    }
    // Riders — real fleet data only
    if (!isCustom && stat && stat.riders > 0) {
      result.push({ big: String(stat.riders), label: t('onboarding.v2BrandHeroRidersOnThis') });
    }
    // Models — real fleet data only
    if (!isCustom && stat && stat.models > 0) {
      result.push({ big: String(stat.models), label: t('onboarding.v2BrandHeroModelsTracked') });
    }
    return result;
  }, [brandDna, stat, isCustom, t]);

  if (cells.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(450)}>
      <Text style={[type.label, { color: oc.textSecondary, marginBottom: space.xs }]}>
        {t('onboarding.v2BrandHeroLoadedForYou')}
      </Text>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {cells.map((cell) => (
          <View
            key={cell.label}
            style={{
              flex: 1,
              padding: space.sm,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              backgroundColor: oc.surface,
            }}
          >
            <Text
              style={[type.figureSmall, { color: oc.textPrimary, marginBottom: space.xxs }]}
              numberOfLines={1}
            >
              {cell.big}
            </Text>
            <Text style={[type.caption, { color: oc.textMuted }]}>{cell.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function RegisteredStamp({
  makeName,
  isCustom,
  stat,
  color,
}: {
  makeName: string;
  isCustom: boolean;
  stat: MakeStat | undefined;
  color: string;
}) {
  const oc = useOnboardingColors();
  const { t, i18n } = useTranslation();
  const stampDate = useMemo(
    () =>
      new Date().toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [i18n.language],
  );

  const welcomeMessage = isCustom
    ? t('onboarding.v2BrandHeroWelcomeCustom')
    : stat && stat.riders > 0
      ? t('onboarding.v2BrandHeroWelcomeRiders', { count: stat.riders + 1, makeName })
      : t('onboarding.v2BrandHeroWelcomeGeneric', { makeName });

  return (
    <Animated.View
      entering={FadeInUp.delay(650).duration(460)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: oc.surface,
      }}
    >
      {/* Seal */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: oc.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[type.figure, { color: oc.textPrimary }]}>{isCustom ? '?' : makeName[0]}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.caption, { color: oc.textMuted, marginBottom: 2 }]}>
          {t('onboarding.v2BrandHeroRegistered')} · {stampDate}
        </Text>
        <Text style={[type.subhead, { color: oc.textPrimary }]}>{welcomeMessage}</Text>
      </View>
    </Animated.View>
  );
}

export function BrandHero({ makeName, isCustom, stats, onChangeMake }: BrandHeroProps) {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const color = getBrandColor(makeName);
  const brandDna = getBrandDna(makeName);
  const stat = stats.find((s) => s.make.toLowerCase() === makeName.toLowerCase());

  return (
    <View style={{ gap: 16 }}>
      {/* Hero card */}
      <Animated.View
        entering={FadeIn.duration(540)}
        style={{
          position: 'relative',
          borderRadius: radius.plate,
          borderCurve: 'continuous',
          overflow: 'hidden',
          padding: space.lg,
          paddingBottom: space.xl,
          minHeight: 180,
          backgroundColor: oc.surface,
          borderWidth: 1,
          borderColor: oc.cardBorder,
        }}
      >
        {/* Change button */}
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            onPress={onChangeMake}
            accessibilityRole="button"
            accessibilityLabel="Change make"
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 32,
              paddingHorizontal: space.sm,
              borderRadius: radius.pill,
              backgroundColor: oc.surface2,
            }}
          >
            <RefreshCw size={13} color={oc.warm2} />
            <Text style={[type.label, { color: oc.warm2 }]}>
              {t('onboarding.v2BrandHeroChange')}
            </Text>
          </Pressable>
        </View>

        {/* Brand identity */}
        <View style={{ marginTop: 14, maxWidth: '78%' }}>
          {/* Popularity badge */}
          {stat && !isCustom && <PopularityBadge stat={stat} />}

          {/* Make name */}
          <Animated.Text
            entering={FadeInUp.delay(200).duration(600)}
            style={[type.largeTitle, { color: oc.textPrimary, marginBottom: space.xs }]}
          >
            {isCustom ? t('onboarding.v2BrandHeroOther') : makeName}
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text
            entering={FadeIn.delay(450).duration(500)}
            style={[type.subhead, { color: oc.textBody, maxWidth: 240 }]}
          >
            {isCustom ? t('onboarding.v2BrandHeroCustomTagline') : (brandDna?.tagline ?? '')}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Stats row — only if we have data */}
      <StatsRow brandDna={brandDna} stat={stat} isCustom={isCustom} />

      {/* Registered stamp */}
      <RegisteredStamp makeName={makeName} isCustom={isCustom} stat={stat} color={color} />
    </View>
  );
}
