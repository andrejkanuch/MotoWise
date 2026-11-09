/**
 * Rider insights: the season as a place you rode. One live map of the main
 * riding region with the totals band, the other regions as tiles, the weeks
 * ridden, and "How you ride", where each insight opens its own page and Pro
 * rows show the rider's own pattern blurred. Every number comes from the
 * `riderInsights` query; the season shown is the API's.
 */
import { format, parseISO } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  PROFILE_ROUTE,
  RIDER_INSIGHTS_DETAIL_GROUP,
  RIDER_INSIGHTS_ENTRY,
  type RiderInsightsDetailGroup,
  type RiderInsightsEntry,
} from '@/config/routes';
import { AtlasHero } from '@/features/rider-insights/atlas-hero';
import { HowYouRideList } from '@/features/rider-insights/how-you-ride-list';
import { RegionTiles, swapMainRegion } from '@/features/rider-insights/region-tiles';
import { SeasonRibbon } from '@/features/rider-insights/season-ribbon';
import { InsightsShareButton, InsightsShareSheet } from '@/features/rider-insights/share-sheet';
import {
  formatInsightDistance,
  INSIGHTS_VIEW,
  type RiderInsightsData,
  type RiderInsightsRegion,
  useRiderInsights,
} from '@/features/rider-insights/use-rider-insights';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, layout, space } from '@/theme/spacing';
import { CONTENT_MAX_WIDTH, radius, readableWidth, SYSTEM_WEIGHT, type } from '@/theme/type';

const ISO_DAY = 'yyyy-MM-dd';
const ENTRIES: ReadonlySet<string> = new Set(Object.values(RIDER_INSIGHTS_ENTRY));

function entryFrom(param: string | string[] | undefined): RiderInsightsEntry {
  const value = Array.isArray(param) ? param[0] : param;
  return value && ENTRIES.has(value) ? (value as RiderInsightsEntry) : RIDER_INSIGHTS_ENTRY.UNKNOWN;
}

/** Regions in the order the rider swapped them into; unknown keys fall back to the API's order. */
function orderRegions(
  regions: readonly RiderInsightsRegion[],
  order: readonly string[] | null,
): RiderInsightsRegion[] {
  if (!order) return [...regions];
  const byKey = new Map(regions.map((region) => [region.key, region]));
  const ordered = order.flatMap((key) => byKey.get(key) ?? []);
  return ordered.length === regions.length ? ordered : [...regions];
}

export default function RiderInsightsScreen() {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const system = useMeasurementSystem();
  const { width: windowWidth } = useWindowDimensions();
  const bottom = useTabBarClearance();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const openedFrom = entryFrom(entry);
  const { insights, view, stale, mapAvailable, unlocking, onPurchased, retry } = useRiderInsights();
  const [order, setOrder] = useState<string[] | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    trackEvent(AnalyticsEvent.RIDER_INSIGHTS_OPENED, { entry: openedFrom });
  }, [openedFrom]);

  const width = Math.min(windowWidth, CONTENT_MAX_WIDTH) - 2 * GUTTER;
  const language = instance.language;

  const openDetail = (group: RiderInsightsDetailGroup) =>
    router.push({ pathname: PROFILE_ROUTE.RIDER_INSIGHTS_DETAIL, params: { group } });

  const scrollProps = {
    contentInsetAdjustmentBehavior: 'automatic' as const,
    style: { flex: 1, backgroundColor: t.bg },
    contentContainerStyle: [
      readableWidth,
      {
        paddingHorizontal: GUTTER,
        paddingTop: space.xs,
        paddingBottom: bottom,
        gap: layout.sectionGap,
      },
    ],
  };

  if (view !== INSIGHTS_VIEW.READY || !insights) {
    return (
      <ScrollView {...scrollProps}>
        {view === INSIGHTS_VIEW.LOADING ? (
          <View testID="insights-loading" style={{ paddingVertical: space.xxxl }}>
            <ActivityIndicator color={t.ink3} />
          </View>
        ) : (
          <Notice
            testID={`insights-${view}`}
            title={
              view === INSIGHTS_VIEW.OFFLINE
                ? i18n('riderInsights.offline.title')
                : i18n('riderInsights.error.title')
            }
            body={
              view === INSIGHTS_VIEW.OFFLINE
                ? i18n('riderInsights.offline.body')
                : i18n('riderInsights.error.body')
            }
            action={
              view === INSIGHTS_VIEW.OFFLINE
                ? i18n('riderInsights.offline.retry')
                : i18n('riderInsights.error.retry')
            }
            onAction={() => void retry()}
          />
        )}
      </ScrollView>
    );
  }

  if (insights.totals.rides === 0) {
    return (
      <ScrollView {...scrollProps}>
        <Notice
          testID="insights-empty"
          title={i18n('riderInsights.empty.title')}
          body={i18n('riderInsights.empty.body')}
        />
      </ScrollView>
    );
  }

  const regions = orderRegions(insights.regions, order);
  const main = regions[0] ?? null;
  const regionName = (region: RiderInsightsRegion) =>
    region.name ?? i18n('riderInsights.regions.unnamed');
  const regionMeta = (region: RiderInsightsRegion) =>
    i18n('riderInsights.regions.meta', {
      count: region.rides,
      distance: formatInsightDistance(region.distanceM, system, language),
    });

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: mapAvailable
            ? () => <InsightsShareButton onPress={() => setSharing(true)} />
            : undefined,
        }}
      />
      <ScrollView {...scrollProps}>
        <View style={{ gap: layout.titleGap }}>
          <Text style={[type.subhead, { color: t.ink3 }]}>
            {seasonLine(insights, i18n, language)}
          </Text>
          {stale ? (
            <Text testID="insights-stale" style={[type.caption, { color: t.ink3 }]}>
              {i18n('riderInsights.stale')}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: space.sm }}>
          <AtlasHero
            region={main}
            totals={insights.totals}
            countries={insights.countries}
            mapAvailable={mapAvailable}
            width={width}
            system={system}
            regionName={regionName}
            regionMeta={regionMeta}
            onOpenCountries={() => openDetail(RIDER_INSIGHTS_DETAIL_GROUP.COUNTRIES)}
          />
          {regions.length >= 2 && mapAvailable ? (
            <RegionTiles
              tiles={regions.slice(1)}
              width={width}
              regionName={regionName}
              formatMeta={regionMeta}
              onSelect={(key) => setOrder(swapMainRegion(regions, key).map((r) => r.key))}
            />
          ) : null}
        </View>

        <SeasonRibbon ribbon={insights.ribbon} season={insights.season} system={system} />

        <HowYouRideList
          insights={insights}
          mainRegion={mapAvailable ? main : null}
          unlocking={unlocking}
          system={system}
          onPurchased={() => void onPurchased()}
          onOpenDetail={openDetail}
        />
      </ScrollView>
      <InsightsShareSheet
        visible={sharing}
        onClose={() => setSharing(false)}
        insights={insights}
        regions={regions}
        regionName={regionName}
        system={system}
        unlocking={unlocking}
        onPurchased={() => void onPurchased()}
      />
    </>
  );
}

/** "Season 2026, 1 Jan to today" */
function seasonLine(insights: RiderInsightsData, i18n: TFunction, language: string): string {
  const dayMonth = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const from = parseISO(insights.season.from);
  const isToday = insights.season.to === format(new Date(), ISO_DAY);
  return i18n('riderInsights.seasonRange', {
    year: from.getFullYear(),
    from: dayMonth.format(from),
    to: isToday ? i18n('riderInsights.today') : dayMonth.format(parseISO(insights.season.to)),
  });
}

interface NoticeProps {
  testID: string;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}

/** A full-width state card: offline, failed or empty. Never a number. */
function Notice({ testID, title, body, action, onAction }: NoticeProps) {
  const { t } = useEditorialTheme();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: t.surface,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        padding: space.md,
        gap: space.xs,
      }}
    >
      <Text style={[type.bodyStrong, { color: t.ink }]}>{title}</Text>
      <Text style={[type.subhead, { color: t.ink2 }]}>{body}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={space.xs}
          style={{ alignSelf: 'flex-start', paddingTop: space.xxs }}
        >
          <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
