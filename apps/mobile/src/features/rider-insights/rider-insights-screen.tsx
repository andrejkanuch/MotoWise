/**
 * Rider insights: the season as a place you rode. One map of the main riding
 * region with the totals band (a tap opens it full screen), the other regions
 * as tiles, the weeks ridden (a tap opens the season), and "How you ride",
 * where each insight opens its own page and Pro rows show the rider's own
 * pattern blurred. Every number comes from the
 * `riderInsights` query; the season shown is the API's.
 */
import { format, parseISO } from 'date-fns';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useState } from 'react';
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
  RIDER_INSIGHTS_DETAIL_GROUP,
  RIDER_INSIGHTS_ENTRY,
  type RiderInsightsDetailGroup,
  type RiderInsightsEntry,
} from '@/config/routes';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, layout, space } from '@/theme/spacing';
import { CONTENT_MAX_WIDTH, radius, readableWidth, SYSTEM_WEIGHT, type } from '@/theme/type';
import { AtlasFullMap } from './atlas-full-map';
import { AtlasHero } from './atlas-hero';
import { HowYouRideList } from './how-you-ride-list';
import { RecapEntryRow } from './recap/recap-entry-row';
import { RegionTiles, swapMainRegion } from './region-tiles';
import { SeasonRibbon, seasonEndSoFar } from './season-ribbon';
import { InsightsShareButton, InsightsShareSheet } from './share-sheet';
import {
  formatInsightDistance,
  INSIGHTS_VIEW,
  type InsightsView,
  type RiderInsightsData,
  type RiderInsightsRegion,
  useRiderInsights,
} from './use-rider-insights';
import { useRiderInsightsRoutes } from './use-rider-insights-routes';

const ISO_DAY = 'yyyy-MM-dd';
/** Place names come from GeoNames, which asks for credit under CC BY 4.0. */
const GEONAMES_URL = 'https://www.geonames.org/';
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

export function RiderInsightsScreen() {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const system = useMeasurementSystem();
  const routes = useRiderInsightsRoutes();
  const { width: windowWidth } = useWindowDimensions();
  const bottom = useTabBarClearance();
  const { entry } = useLocalSearchParams<{ entry?: string }>();
  const openedFrom = entryFrom(entry);
  const { insights, view, stale, mapAvailable, unlocking, onPurchased, retry } = useRiderInsights();
  const [order, setOrder] = useState<string[] | null>(null);
  const [sharing, setSharing] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    trackEvent(AnalyticsEvent.RIDER_INSIGHTS_OPENED, { entry: openedFrom });
  }, [openedFrom]);

  const width = Math.min(windowWidth, CONTENT_MAX_WIDTH) - 2 * GUTTER;
  const language = instance.language;

  const openDetail = (group: RiderInsightsDetailGroup) =>
    router.push({ pathname: routes.DETAIL, params: { group } });

  const ready = view === INSIGHTS_VIEW.READY && insights !== null;
  const content = ready && insights.totals.rides > 0 ? insights : null;
  const regions = useMemo(
    () => (content ? orderRegions(content.regions, order) : []),
    [content, order],
  );
  const main = regions[0] ?? null;
  const regionName = (region: RiderInsightsRegion) =>
    region.name ?? i18n('riderInsights.regions.unnamed');
  const regionMeta = (region: RiderInsightsRegion) =>
    i18n('riderInsights.regions.meta', {
      count: region.rides,
      distance: formatInsightDistance(region.distanceM, system, language),
    });

  // The share button is in the header from the first render and only shows once
  // there is something to share, so the header items never change under the title.
  const canShare = content !== null && mapAvailable;
  const headerOptions = useMemo(
    () => ({
      headerRight: () => (
        <InsightsShareButton hidden={!canShare} onPress={() => setSharing(true)} />
      ),
    }),
    [canShare],
  );

  // One scroll view for every state: the iOS large title binds to the first
  // scroll view it sees and does not re-attach when another one replaces it.
  return (
    <>
      <Stack.Screen options={headerOptions} />
      <ScrollView
        testID="insights-scroll"
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: t.bg }}
        contentContainerStyle={[
          readableWidth,
          {
            paddingHorizontal: GUTTER,
            paddingTop: space.xs,
            paddingBottom: bottom,
            gap: layout.sectionGap,
          },
        ]}
      >
        {!ready ? (
          <StateNotice view={view} onRetry={() => void retry()} />
        ) : !content ? (
          <Notice
            testID="insights-empty"
            title={i18n('riderInsights.empty.title')}
            body={i18n('riderInsights.empty.body')}
          />
        ) : (
          <>
            <View style={{ gap: layout.titleGap }}>
              <Text style={[type.subhead, { color: t.ink3 }]}>
                {seasonLine(content, i18n, language)}
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
                totals={content.totals}
                countries={content.countries}
                mapAvailable={mapAvailable}
                width={width}
                system={system}
                regionName={regionName}
                regionMeta={regionMeta}
                onOpenCountries={() => openDetail(RIDER_INSIGHTS_DETAIL_GROUP.COUNTRIES)}
                onExpand={() => setMapOpen(true)}
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

            <SeasonRibbon
              ribbon={content.ribbon}
              season={content.season}
              system={system}
              onPress={() => openDetail(RIDER_INSIGHTS_DETAIL_GROUP.SEASON)}
            />

            <HowYouRideList
              insights={content}
              mainRegion={mapAvailable ? main : null}
              unlocking={unlocking}
              system={system}
              onPurchased={() => void onPurchased()}
              onOpenDetail={openDetail}
            />

            <RecapEntryRow
              insights={content}
              onPress={() => router.push({ pathname: routes.RECAP })}
            />

            <PlaceNamesCredit />
          </>
        )}
      </ScrollView>
      {content && mapAvailable ? (
        <AtlasFullMap visible={mapOpen} regions={regions} onClose={() => setMapOpen(false)} />
      ) : null}
      {content ? (
        <InsightsShareSheet
          visible={sharing}
          onClose={() => setSharing(false)}
          insights={content}
          regions={regions}
          regionName={regionName}
          system={system}
          unlocking={unlocking}
          onPurchased={() => void onPurchased()}
        />
      ) : null}
    </>
  );
}

/** Loading, offline or failed: a spinner or one notice, never a number. */
function StateNotice({ view, onRetry }: { view: InsightsView; onRetry: () => void }) {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  if (view === INSIGHTS_VIEW.LOADING) {
    return (
      <View testID="insights-loading" style={{ paddingVertical: space.xxxl }}>
        <ActivityIndicator color={t.ink3} />
      </View>
    );
  }
  const offline = view === INSIGHTS_VIEW.OFFLINE;
  return (
    <Notice
      testID={`insights-${view}`}
      title={offline ? i18n('riderInsights.offline.title') : i18n('riderInsights.error.title')}
      body={offline ? i18n('riderInsights.offline.body') : i18n('riderInsights.error.body')}
      action={offline ? i18n('riderInsights.offline.retry') : i18n('riderInsights.error.retry')}
      onAction={onRetry}
    />
  );
}

/** "Season 2026, 1 Jan to today"; a past season keeps its own last day. */
function seasonLine(insights: RiderInsightsData, i18n: TFunction, language: string): string {
  const dayMonth = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const from = parseISO(insights.season.from);
  const today = format(new Date(), ISO_DAY);
  const isToday = seasonEndSoFar(insights.season, today) === today;
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

/** The GeoNames credit the place names need: a quiet caption link under the list. */
function PlaceNamesCredit() {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  return (
    <Pressable
      testID="insights-geonames-credit"
      accessibilityRole="link"
      onPress={() => void WebBrowser.openBrowserAsync(GEONAMES_URL)}
      hitSlop={space.xs}
      style={{ alignSelf: 'flex-start', marginHorizontal: space.md }}
    >
      <Text style={[type.caption, { color: t.ink3 }]}>
        {i18n('riderInsights.placeNamesCredit')}
      </Text>
    </Pressable>
  );
}
