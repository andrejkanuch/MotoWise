/**
 * One Rider insights group on its own page, pushed from "How you ride" (or a
 * deep link). Reads the same `riderInsights` cache as the main screen. A Pro
 * page for a rider without Pro shows the locked template; free pages (bikes,
 * countries, the season, the longest ride) show in full.
 */
import { RiderInsightsStatus } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import type { TFunction } from 'i18next';
import { type ReactNode, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, useWindowDimensions, View } from 'react-native';
import { RIDER_INSIGHTS_DETAIL_GROUP, type RiderInsightsDetailGroup } from '@/config/routes';
import { useMeasurementSystem } from '@/hooks/use-measurement-system';
import { useTabBarClearance } from '@/hooks/use-tab-bar-clearance';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import type { RiderInsightsPaywallRow } from '@/lib/paywall-surfaces';
import { presentRiderInsightsPaywall } from '@/lib/subscription';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, layout, space } from '@/theme/spacing';
import { CONTENT_MAX_WIDTH, readableWidth } from '@/theme/type';
import { blurCaptureKey } from '../blur-capture';
import { buildInsightsPaywallCopy, insightsPaywallNumbers } from '../paywall-copy';
import { INSIGHTS_VIEW, type RiderInsightsData, useRiderInsights } from '../use-rider-insights';
import { BestRidesDetail, BestRidesFree } from './best-rides';
import { BikesDetail } from './bikes';
import { CountriesDetail } from './countries';
import { formatArea, formatNumber, formatPercent, PAYWALL_ROW_BY_GROUP } from './detail-format';
import { StateNotice } from './detail-parts';
import {
  DETAIL_BLUR,
  LockedDetail,
  TEASER_BAR_HEIGHT,
  TEASER_GRID_HEIGHT,
  TEASER_PATTERN_HEIGHT,
  TeaserBandBar,
  TeaserGrid,
  TeaserPattern,
} from './locked-detail';
import { RhythmDetail } from './rhythm';
import { RoadCharacterDetail } from './road-character';
import { SeasonDetail } from './season';
import { TerritoryDetail } from './territory';

/** Property on the locked-row events that tells a detail page from a list row. */
const DETAIL_SURFACE = 'detail';

const TITLE: Record<RiderInsightsDetailGroup, (t: TFunction) => string> = {
  [RIDER_INSIGHTS_DETAIL_GROUP.ROAD_CHARACTER]: (t) =>
    t('riderInsights.howYouRide.roadCharacter.title'),
  [RIDER_INSIGHTS_DETAIL_GROUP.TERRITORY]: (t) => t('riderInsights.howYouRide.territory.title'),
  [RIDER_INSIGHTS_DETAIL_GROUP.RHYTHM]: (t) => t('riderInsights.howYouRide.rhythm.title'),
  [RIDER_INSIGHTS_DETAIL_GROUP.BEST_RIDES]: (t) => t('riderInsights.howYouRide.bestRides.title'),
  [RIDER_INSIGHTS_DETAIL_GROUP.BIKES]: (t) => t('riderInsights.howYouRide.bikes.title'),
  [RIDER_INSIGHTS_DETAIL_GROUP.COUNTRIES]: (t) => t('riderInsights.detail.countries.title'),
  [RIDER_INSIGHTS_DETAIL_GROUP.SEASON]: (t) => t('riderInsights.ribbon.section'),
};

/** The native header title of a detail page. */
export function detailTitle(group: RiderInsightsDetailGroup, t: TFunction): string {
  return TITLE[group](t);
}

/** Whether this page is the locked template (or, for best rides, the free view) for this rider. */
function isLocked(group: RiderInsightsDetailGroup, insights: RiderInsightsData): boolean {
  const status: Partial<Record<RiderInsightsDetailGroup, RiderInsightsStatus>> = {
    [RIDER_INSIGHTS_DETAIL_GROUP.ROAD_CHARACTER]: insights.roadCharacter.status,
    [RIDER_INSIGHTS_DETAIL_GROUP.TERRITORY]: insights.territory.status,
    [RIDER_INSIGHTS_DETAIL_GROUP.RHYTHM]: insights.rhythm.status,
    [RIDER_INSIGHTS_DETAIL_GROUP.BEST_RIDES]: insights.bestRides.status,
  };
  return status[group] === RiderInsightsStatus.Locked;
}

interface PageContext {
  insights: RiderInsightsData;
  system: MeasurementSystem;
  i18n: TFunction;
  language: string;
  unlocking: boolean;
  /** Width of a graphic inside a padded card. */
  graphicWidth: number;
  isDark: boolean;
  fontScale: number;
  onUnlock: (row: RiderInsightsPaywallRow) => void;
}

/**
 * The shared states of a Pro group, in the API's precedence. Null when the
 * group is ready or locked, which the page draws itself.
 */
function proGroupState(
  status: RiderInsightsStatus,
  missing: string,
  i18n: TFunction,
): ReactNode | null {
  const body: Partial<Record<RiderInsightsStatus, string>> = {
    [RiderInsightsStatus.NotEnough]: i18n('riderInsights.howYouRide.keepRiding'),
    [RiderInsightsStatus.Computing]: i18n('riderInsights.howYouRide.computing'),
    [RiderInsightsStatus.MissingInput]: missing,
  };
  const text = body[status];
  return text ? <StateNotice testID={`detail-${status.toLowerCase()}`} body={text} /> : null;
}

const computingNotice = (i18n: TFunction) => (
  <StateNotice testID="detail-computing" body={i18n('riderInsights.howYouRide.computing')} />
);

const PAGE: Record<RiderInsightsDetailGroup, (ctx: PageContext) => ReactNode> = {
  [RIDER_INSIGHTS_DETAIL_GROUP.ROAD_CHARACTER]: (ctx) => {
    const group = ctx.insights.roadCharacter;
    const state = proGroupState(
      group.status,
      ctx.i18n('riderInsights.howYouRide.missingRoute'),
      ctx.i18n,
    );
    if (state) return state;
    if (group.status === RiderInsightsStatus.Locked) {
      const b = group.teaser?.bandShares;
      const row = PAYWALL_ROW_BY_GROUP[RIDER_INSIGHTS_DETAIL_GROUP.ROAD_CHARACTER];
      return (
        <LockedDetail
          figure={group.headline === null ? null : formatNumber(group.headline, ctx.language)}
          line={ctx.i18n('riderInsights.detail.locked.roadCharacter')}
          teaser={ctx.i18n('riderInsights.howYouRide.roadCharacter.teaser')}
          captureKey={blurCaptureKey({
            row: `detail-${row}`,
            data: group.teaser,
            isDark: ctx.isDark,
            fontScale: ctx.fontScale,
          })}
          graphic={
            <TeaserBandBar
              shares={b ? [b.straight, b.sweeping, b.twisty, b.tight] : [1, 0, 0, 0]}
              width={ctx.graphicWidth}
            />
          }
          graphicWidth={ctx.graphicWidth}
          graphicHeight={TEASER_BAR_HEIGHT}
          blurRadius={DETAIL_BLUR.band}
          unlocking={ctx.unlocking}
          onUnlock={() => row && ctx.onUnlock(row)}
        />
      );
    }
    return group.detail ? (
      <RoadCharacterDetail detail={group.detail} system={ctx.system} />
    ) : (
      computingNotice(ctx.i18n)
    );
  },

  [RIDER_INSIGHTS_DETAIL_GROUP.TERRITORY]: (ctx) => {
    const group = ctx.insights.territory;
    const state = proGroupState(
      group.status,
      ctx.i18n('riderInsights.howYouRide.missingRoute'),
      ctx.i18n,
    );
    if (state) return state;
    if (group.status === RiderInsightsStatus.Locked) {
      const region = ctx.insights.regions[0] ?? null;
      const row = PAYWALL_ROW_BY_GROUP[RIDER_INSIGHTS_DETAIL_GROUP.TERRITORY];
      return (
        <LockedDetail
          figure={
            group.headline === null ? null : formatArea(group.headline, ctx.system, ctx.language)
          }
          line={ctx.i18n('riderInsights.detail.locked.territory')}
          teaser={ctx.i18n('riderInsights.howYouRide.territory.teaser')}
          captureKey={blurCaptureKey({
            row: `detail-${row}`,
            data: [region?.key, region?.routes.length, ctx.graphicWidth],
            isDark: ctx.isDark,
            fontScale: ctx.fontScale,
          })}
          graphic={<TeaserPattern region={region} width={ctx.graphicWidth} />}
          graphicWidth={ctx.graphicWidth}
          graphicHeight={TEASER_PATTERN_HEIGHT}
          blurRadius={DETAIL_BLUR.pattern}
          unlocking={ctx.unlocking}
          onUnlock={() => row && ctx.onUnlock(row)}
        />
      );
    }
    return group.detail ? (
      <TerritoryDetail detail={group.detail} system={ctx.system} />
    ) : (
      computingNotice(ctx.i18n)
    );
  },

  [RIDER_INSIGHTS_DETAIL_GROUP.RHYTHM]: (ctx) => {
    const group = ctx.insights.rhythm;
    const state = proGroupState(
      group.status,
      ctx.i18n('riderInsights.howYouRide.rhythm.missing'),
      ctx.i18n,
    );
    if (state) return state;
    if (group.status === RiderInsightsStatus.Locked) {
      const row = PAYWALL_ROW_BY_GROUP[RIDER_INSIGHTS_DETAIL_GROUP.RHYTHM];
      return (
        <LockedDetail
          figure={group.headline === null ? null : formatPercent(group.headline, ctx.language)}
          line={ctx.i18n('riderInsights.detail.locked.rhythm')}
          teaser={ctx.i18n('riderInsights.howYouRide.rhythm.teaser')}
          captureKey={blurCaptureKey({
            row: `detail-${row}`,
            data: [group.teaser, ctx.graphicWidth],
            isDark: ctx.isDark,
            fontScale: ctx.fontScale,
          })}
          graphic={<TeaserGrid levels={group.teaser?.grid ?? []} width={ctx.graphicWidth} />}
          graphicWidth={ctx.graphicWidth}
          graphicHeight={TEASER_GRID_HEIGHT}
          blurRadius={DETAIL_BLUR.grid}
          unlocking={ctx.unlocking}
          onUnlock={() => row && ctx.onUnlock(row)}
        />
      );
    }
    return group.detail ? (
      <RhythmDetail detail={group.detail} system={ctx.system} />
    ) : (
      computingNotice(ctx.i18n)
    );
  },

  [RIDER_INSIGHTS_DETAIL_GROUP.BEST_RIDES]: (ctx) => {
    const group = ctx.insights.bestRides;
    const state = proGroupState(
      group.status,
      ctx.i18n('riderInsights.howYouRide.computing'),
      ctx.i18n,
    );
    if (state) return state;
    if (group.status === RiderInsightsStatus.Locked) {
      const row = PAYWALL_ROW_BY_GROUP[RIDER_INSIGHTS_DETAIL_GROUP.BEST_RIDES];
      return (
        <BestRidesFree
          longest={ctx.insights.longestRide}
          rankedCount={group.headline}
          system={ctx.system}
          unlocking={ctx.unlocking}
          onUnlock={() => row && ctx.onUnlock(row)}
        />
      );
    }
    return group.detail ? (
      <BestRidesDetail detail={group.detail} system={ctx.system} />
    ) : (
      computingNotice(ctx.i18n)
    );
  },

  [RIDER_INSIGHTS_DETAIL_GROUP.BIKES]: (ctx) => {
    const group = ctx.insights.bikes;
    if (group.status === RiderInsightsStatus.MissingInput) {
      return (
        <StateNotice
          testID="detail-missing_input"
          body={ctx.i18n('riderInsights.howYouRide.bikes.missing')}
        />
      );
    }
    if (group.status !== RiderInsightsStatus.Ready || !group.items?.length) {
      return computingNotice(ctx.i18n);
    }
    return <BikesDetail items={group.items} system={ctx.system} />;
  },

  [RIDER_INSIGHTS_DETAIL_GROUP.COUNTRIES]: (ctx) =>
    ctx.insights.countries.length > 0 ? (
      <CountriesDetail countries={ctx.insights.countries} system={ctx.system} />
    ) : (
      <StateNotice testID="detail-missing_input" body={ctx.i18n('riderInsights.hero.noRoutes')} />
    ),

  [RIDER_INSIGHTS_DETAIL_GROUP.SEASON]: (ctx) => (
    <SeasonDetail insights={ctx.insights} system={ctx.system} />
  ),
};

export function RiderInsightsDetailScreen({ group }: { group: RiderInsightsDetailGroup }) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const system = useMeasurementSystem();
  const bottom = useTabBarClearance();
  const { insights, view, unlocking, onPurchased, retry } = useRiderInsights();
  const language = instance.language;
  const locked = insights ? isLocked(group, insights) : false;
  const paywallRow = PAYWALL_ROW_BY_GROUP[group];

  // A locked page is a locked row the rider is looking at: report it once per visit.
  useEffect(() => {
    if (locked && paywallRow) {
      trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_SHOWN, {
        row: paywallRow,
        surface: DETAIL_SURFACE,
      });
    }
  }, [locked, paywallRow]);

  const onUnlock = useCallback(
    async (row: RiderInsightsPaywallRow) => {
      if (!insights) return;
      trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, {
        row,
        surface: DETAIL_SURFACE,
      });
      const copy = buildInsightsPaywallCopy(row, insightsPaywallNumbers(insights), {
        t: i18n,
        system,
        language,
      });
      const result = await presentRiderInsightsPaywall(row, copy);
      if (result === 'purchased' || result === 'restored') void onPurchased();
    },
    [insights, i18n, system, language, onPurchased],
  );

  const pageWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH) - 2 * GUTTER;

  return (
    <ScrollView
      testID={`rider-insights-detail-${group}`}
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={[
        readableWidth,
        {
          paddingHorizontal: GUTTER,
          paddingTop: space.sm,
          paddingBottom: bottom,
          gap: layout.sectionGap,
        },
      ]}
    >
      {view === INSIGHTS_VIEW.LOADING ? (
        <View testID="detail-loading" style={{ paddingVertical: space.xxxl }}>
          <ActivityIndicator color={t.ink3} />
        </View>
      ) : view === INSIGHTS_VIEW.OFFLINE || view === INSIGHTS_VIEW.ERROR || !insights ? (
        <StateNotice
          testID={`detail-${view}`}
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
      ) : (
        PAGE[group]({
          insights,
          system,
          i18n,
          language,
          unlocking,
          graphicWidth: pageWidth - 2 * space.md,
          isDark,
          fontScale,
          onUnlock: (row) => void onUnlock(row),
        })
      )}
    </ScrollView>
  );
}
