import { GetRideSummaryStatsDocument, type GetRideSummaryStatsQuery } from '@motovault/graphql';
import { RIDER_INSIGHTS_MIN_QUALIFYING_RIDES } from '@motovault/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { InsightsLinkRow, insightsStateCaption } from '@/components/home/insights-card';
import { RIDER_INSIGHTS_ENTRY, riderInsightsHref } from '@/config/routes';
import { BlurCapture, blurCaptureKey } from '@/features/rider-insights/blur-capture';
import { buildInsightsPaywallCopy } from '@/features/rider-insights/paywall-copy';
import {
  deviceTimeZone,
  formatInsightDistance,
  type RiderInsightsData,
  riderInsightsOptions,
  useRiderInsights,
} from '@/features/rider-insights/use-rider-insights';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { RIDER_INSIGHTS_PAYWALL_ROW } from '@/lib/paywall-surfaces';
import { queryKeys } from '@/lib/query-keys';
import { isQualifyingRide, markTeaserShown } from '@/lib/ride-milestone-trigger';
import { presentRiderInsightsPaywall } from '@/lib/subscription';
import { useAuthStore } from '@/stores/auth.store';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';
import { useRideTeaserEvaluation } from './use-ride-teaser-evaluation';

/** How often the ride is asked again while its server stats are pending. */
export const SUMMARY_STATS_POLL_MS = 3_000;
/** The card stops asking after this long and keeps the device's numbers. */
export const SUMMARY_STATS_MAX_WAIT_MS = 30_000;
const TILE_MIN_HEIGHT = 78;
const BLUR_RADIUS = 14;
const BLUR_WIDTH = 120;
const BLUR_HEIGHT = 30;
const PRESS_TINT = 0.06;

type SummaryRide = GetRideSummaryStatsQuery['ride'];

/** A ride's stats are current once the server has written its stats row. */
export function rideStatsCurrent(ride: SummaryRide | undefined): boolean {
  return Boolean(ride?.stats);
}

/** What the card shows, from the season so far and this ride. Only free numbers unless Pro. */
export const SUMMARY_TILE = {
  /** Fewer than five qualifying rides: no tile, the keep-riding line, a tap opens the screen. */
  KEEP_RIDING: 'keep_riding',
  /** Pro with this ride's new-road distance from the server (0 included). */
  NEW_ROADS: 'new_roads',
  /** Pro while the server value is still pending: no number in the tile. */
  COMPUTING: 'computing',
  /** Not Pro: the tile blurred, "Unlock with Pro". */
  LOCKED: 'locked',
} as const;

export type SummaryTile = (typeof SUMMARY_TILE)[keyof typeof SUMMARY_TILE];

export interface SummaryCardModel {
  tile: SummaryTile;
  /** Season distance after this ride; computed on the device when the server has not counted it yet. */
  seasonM: number;
  newRoadsM: number | null;
}

/**
 * The card's model. The season's free totals count every completed ride, so
 * when the season's latest ride is not this one yet, this ride is added on the
 * device, and counted toward the five qualifying rides when it qualifies.
 */
export function summaryCardModel(input: {
  insights: RiderInsightsData;
  rideId: string;
  distanceM: number;
  movingS: number;
  newRoadsM: number | null;
}): SummaryCardModel {
  const { insights, rideId, distanceM, movingS, newRoadsM } = input;
  const counted = insights.latestRide?.rideId === rideId;
  const seasonM = insights.totals.distanceM + (counted ? 0 : distanceM);
  const thisQualifies = isQualifyingRide({ distanceM, movingS, systemEnded: false });
  const qualifying = insights.coverage.qualifyingRides + (!counted && thisQualifies ? 1 : 0);

  if (qualifying < RIDER_INSIGHTS_MIN_QUALIFYING_RIDES) {
    return { tile: SUMMARY_TILE.KEEP_RIDING, seasonM, newRoadsM: null };
  }
  if (!insights.isPro) return { tile: SUMMARY_TILE.LOCKED, seasonM, newRoadsM: null };
  if (newRoadsM === null) return { tile: SUMMARY_TILE.COMPUTING, seasonM, newRoadsM: null };
  return { tile: SUMMARY_TILE.NEW_ROADS, seasonM, newRoadsM };
}

interface RideSummaryInsightsCardProps {
  rideId: string;
  distanceM: number;
  /** Elapsed minus manual and auto pauses, as the paywall trigger counts it. */
  movingS: number;
}

/**
 * The ride summary's Rider insights card: this ride's new roads for Pro, the
 * same tile blurred for everyone else, and the season distance after this
 * ride. Owns the ride-moment paywall trigger: a tap opens the paywall only when
 * the trigger says one may show, and otherwise opens Rider insights.
 */
export function RideSummaryInsightsCard({
  rideId,
  distanceM,
  movingS,
}: RideSummaryInsightsCardProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const system = useMeasurementSystem();
  const { fontScale } = useWindowDimensions();
  const queryClient = useQueryClient();
  const language = instance.language;
  const evaluation = useRideTeaserEvaluation({
    rideId,
    distanceM,
    movingS,
    measurementSystem: system,
  });
  const { insights, view } = useRiderInsights();
  const openedAt = useRef(Date.now());
  const paywallOpened = useRef(false);
  const lockedShown = useRef(false);

  const rideQuery = useQuery({
    queryKey: queryKeys.rides.summaryStats(rideId),
    queryFn: () => gqlFetcher(GetRideSummaryStatsDocument, { id: rideId }),
    enabled: rideId !== '',
    refetchInterval: (query) =>
      rideStatsCurrent(query.state.data?.ride) ||
      Date.now() - openedAt.current >= SUMMARY_STATS_MAX_WAIT_MS
        ? false
        : SUMMARY_STATS_POLL_MS,
  });
  const ride = rideQuery.data?.ride;
  const statsCurrent = rideStatsCurrent(ride);

  // Once the server has this ride's stats, the season numbers are re-read to include it.
  useEffect(() => {
    if (!statsCurrent) return;
    void queryClient.invalidateQueries({
      queryKey: riderInsightsOptions(deviceTimeZone()).queryKey,
    });
  }, [statsCurrent, queryClient]);

  const model = useMemo(
    () =>
      insights
        ? summaryCardModel({
            insights,
            rideId,
            distanceM,
            movingS,
            newRoadsM: ride?.newRoadsM ?? null,
          })
        : null,
    [insights, rideId, distanceM, movingS, ride?.newRoadsM],
  );

  useEffect(() => {
    if (model?.tile !== SUMMARY_TILE.LOCKED || lockedShown.current) return;
    lockedShown.current = true;
    trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_SHOWN, {
      row: RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY,
    });
  }, [model?.tile]);

  const dist = (m: number) => formatInsightDistance(m, system, language);
  const openInsights = () => router.push(riderInsightsHref(RIDER_INSIGHTS_ENTRY.RIDE_SUMMARY));

  const onPress = () => {
    triggerSelection();
    // Below five qualifying rides a tap always opens the screen; the trigger is not asked.
    if (!model || model.tile === SUMMARY_TILE.KEEP_RIDING) return openInsights();
    if (model.tile === SUMMARY_TILE.LOCKED) {
      trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, {
        row: RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY,
      });
    }
    const trigger = evaluation?.trigger;
    if (!evaluation?.shown || !trigger || paywallOpened.current) return openInsights();
    paywallOpened.current = true;
    markTeaserShown(useAuthStore.getState().session?.user.id ?? 'anonymous', trigger);
    const copy = buildInsightsPaywallCopy(
      RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY,
      { seasonDistanceM: model.seasonM, seasonRides: null, longestRideM: null },
      { t: i18n, system, language },
    );
    void presentRiderInsightsPaywall(RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY, copy);
  };

  if (!model) {
    return (
      <InsightsLinkRow
        testID="ride-summary-insights-season"
        title={i18n('riderInsights.title')}
        caption={insightsStateCaption(view, i18n)}
        onPress={onPress}
      />
    );
  }

  const season = i18n('insightsEntry.season', { distance: dist(model.seasonM) });
  const seasonCaption =
    model.tile === SUMMARY_TILE.KEEP_RIDING
      ? i18n('riderInsights.howYouRide.keepRiding')
      : i18n('insightsEntry.withThisRide', { distance: dist(distanceM) });

  return (
    <View style={{ gap: space.sm }}>
      {model.tile === SUMMARY_TILE.KEEP_RIDING ? null : (
        <Pressable
          testID="ride-summary-insights-tile"
          accessibilityRole="button"
          accessibilityLabel={tileA11y(model, dist, i18n)}
          onPress={onPress}
          style={({ pressed }) => ({
            minHeight: TILE_MIN_HEIGHT,
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
            gap: space.xxs,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: t.line,
            backgroundColor:
              pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, PRESS_TINT) : t.surface,
          })}
        >
          <Text style={[type.caption, { color: t.ink3 }]}>{i18n('insightsEntry.newRoads')}</Text>
          {model.tile === SUMMARY_TILE.LOCKED ? (
            <>
              <BlurCapture
                cacheKey={blurCaptureKey({
                  row: RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY,
                  data: distanceM,
                  isDark,
                  fontScale,
                })}
                width={BLUR_WIDTH}
                height={BLUR_HEIGHT}
                blurRadius={BLUR_RADIUS}
              >
                {/* The ride's own (free) distance as the shape under the blur: never a Pro value. */}
                <Text style={[type.figure, { color: t.ink }]}>{dist(distanceM)}</Text>
              </BlurCapture>
              <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>
                {i18n('insightsEntry.unlockPro')}
              </Text>
            </>
          ) : (
            <Text style={[type.figure, { color: model.newRoadsM === null ? t.ink3 : t.ink }]}>
              {model.newRoadsM === null
                ? i18n('insightsEntry.newRoadsComputing')
                : newRoadsValue(model.newRoadsM, distanceM, dist, language, i18n)}
            </Text>
          )}
        </Pressable>
      )}
      <InsightsLinkRow
        testID="ride-summary-insights-season"
        title={season}
        caption={seasonCaption}
        onPress={onPress}
      />
    </View>
  );
}

function newRoadsValue(
  newRoadsM: number,
  distanceM: number,
  dist: (m: number) => string,
  language: string,
  i18n: TFunction,
): string {
  if (distanceM <= 0) return dist(newRoadsM);
  const share = new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(Math.min(1, newRoadsM / distanceM));
  return i18n('insightsEntry.newRoadsValue', { distance: dist(newRoadsM), share });
}

function tileA11y(model: SummaryCardModel, dist: (m: number) => string, i18n: TFunction): string {
  const title = i18n('insightsEntry.newRoads');
  if (model.tile === SUMMARY_TILE.LOCKED) return i18n('insightsEntry.newRoadsLockedA11y');
  if (model.newRoadsM === null) return `${title}. ${i18n('insightsEntry.newRoadsComputing')}`;
  return `${title}. ${dist(model.newRoadsM)}`;
}
