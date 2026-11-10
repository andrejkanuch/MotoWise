import { RIDER_INSIGHTS_MIN_QUALIFYING_RIDES } from '@motovault/types';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { RIDER_INSIGHTS_ENTRY, riderInsightsHref } from '@/config/routes';
import {
  formatInsightDistance,
  INSIGHTS_VIEW,
  type InsightsView,
} from '@/features/rider-insights/use-rider-insights';
import {
  type RiderInsightsHeadline,
  useRiderInsightsHeadline,
} from '@/features/rider-insights/use-rider-insights-headline';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';

const ROW_MIN_HEIGHT = 52;
/** From this font scale the link label moves under the text, so nothing truncates. */
const STACK_FONT_SCALE = 1.5;
const PRESS_TINT = 0.06;

/** What the Home card says. Only free numbers: season distance, the last ride, a new country. */
export const HOME_INSIGHT = {
  /** Season distance after the latest ride, and that ride's distance. */
  SEASON: 'season',
  /** The latest ride added a country to the season. */
  NEW_COUNTRY: 'new_country',
  /** Fewer than five qualifying rides: season distance and the keep-riding line. */
  KEEP_RIDING: 'keep_riding',
} as const;

export type HomeInsight =
  | { kind: typeof HOME_INSIGHT.SEASON; seasonM: number; latestRideM: number | null }
  | { kind: typeof HOME_INSIGHT.NEW_COUNTRY; seasonM: number; country: string }
  | { kind: typeof HOME_INSIGHT.KEEP_RIDING; seasonM: number };

/**
 * The Home card's headline, or null when the season has no rides (the card is
 * hidden). Never reads a Pro group: the headline is always a free number.
 */
export function homeInsightHeadline(insights: RiderInsightsHeadline): HomeInsight | null {
  if (insights.totals.rides === 0) return null;
  const seasonM = insights.totals.distanceM;
  if (insights.coverage.qualifyingRides < RIDER_INSIGHTS_MIN_QUALIFYING_RIDES) {
    return { kind: HOME_INSIGHT.KEEP_RIDING, seasonM };
  }
  const latest = insights.latestRide;
  const newIso = latest?.newCountries[0];
  if (newIso) {
    const country = insights.countries.find((c) => c.isoA2 === newIso)?.name ?? newIso;
    return { kind: HOME_INSIGHT.NEW_COUNTRY, seasonM, country };
  }
  return { kind: HOME_INSIGHT.SEASON, seasonM, latestRideM: latest?.distanceM ?? null };
}

interface InsightsLinkRowProps {
  testID: string;
  /** The main line: a free number, or the screen's name while there is none. */
  title: string;
  caption: string | null;
  onPress: () => void;
}

/**
 * A card-width row that opens Rider insights: a line and a caption on the
 * left, "Rider insights" in copper on the right. Stacks at large text sizes.
 */
export function InsightsLinkRow({ testID, title, caption, onPress }: InsightsLinkRowProps) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_FONT_SCALE;
  const linkLabel = i18n('riderInsights.title');

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={[title, caption].filter(Boolean).join('. ')}
      accessibilityHint={i18n('insightsEntry.openHint')}
      onPress={onPress}
      android_ripple={{ color: t.line }}
      style={({ pressed }) => ({
        minHeight: ROW_MIN_HEIGHT,
        paddingVertical: space.xs,
        paddingHorizontal: space.md,
        gap: stacked ? space.xxs : space.sm,
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'center',
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, PRESS_TINT) : t.surface,
      })}
    >
      <View style={{ flex: stacked ? undefined : 1, minWidth: 0 }}>
        <Text style={[type.body, { color: t.ink }]}>{title}</Text>
        {caption ? <Text style={[type.caption, { color: t.ink3 }]}>{caption}</Text> : null}
      </View>
      <Text style={[type.subhead, SYSTEM_WEIGHT.medium, { color: t.warm2 }]}>{linkLabel}</Text>
    </Pressable>
  );
}

/** The caption for a state with no number: loading, offline or failed. */
export function insightsStateCaption(view: InsightsView, i18n: TFunction): string {
  if (view === INSIGHTS_VIEW.OFFLINE) return i18n('riderInsights.offline.title');
  if (view === INSIGHTS_VIEW.ERROR) return i18n('riderInsights.error.title');
  return i18n('insightsEntry.loading');
}

function headlineLines(
  headline: HomeInsight,
  season: string,
  dist: (m: number) => string,
  i18n: TFunction,
): { title: string; caption: string | null } {
  switch (headline.kind) {
    case HOME_INSIGHT.NEW_COUNTRY:
      return {
        title: i18n('insightsEntry.newCountry', { country: headline.country }),
        caption: season,
      };
    case HOME_INSIGHT.KEEP_RIDING:
      return { title: season, caption: i18n('riderInsights.howYouRide.keepRiding') };
    default:
      return {
        title: season,
        caption:
          headline.latestRideM === null
            ? null
            : i18n('insightsEntry.lastRide', { distance: dist(headline.latestRideM) }),
      };
  }
}

/**
 * Home's Rider insights card: the latest insight headline, always a free
 * number, and a tap opens the screen. Hidden while the season has no rides.
 * Reads the small headline query, never the full season with route geometry.
 */
export function InsightsCard() {
  const { t: i18n, i18n: instance } = useTranslation();
  const system = useMeasurementSystem();
  const { headline: insights, view } = useRiderInsightsHeadline();
  const language = instance.language;
  const headline = useMemo(() => (insights ? homeInsightHeadline(insights) : null), [insights]);

  if (view === INSIGHTS_VIEW.READY && !headline) return null;

  const open = () => {
    triggerSelection();
    router.push(riderInsightsHref(RIDER_INSIGHTS_ENTRY.HOME));
  };

  if (!headline) {
    return (
      <InsightsLinkRow
        testID="home-insights-card"
        title={i18n('riderInsights.title')}
        caption={insightsStateCaption(view, i18n)}
        onPress={open}
      />
    );
  }

  const dist = (m: number) => formatInsightDistance(m, system, language);
  const season = i18n('insightsEntry.season', { distance: dist(headline.seasonM) });
  const { title, caption } = headlineLines(headline, season, dist, i18n);

  return (
    <InsightsLinkRow testID="home-insights-card" title={title} caption={caption} onPress={open} />
  );
}
