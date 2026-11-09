import { RiderInsightsStatus } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import type { TFunction } from 'i18next';
import { ChevronRight } from 'lucide-react-native';
import { Fragment, type ReactNode, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { RIDER_INSIGHTS_DETAIL_GROUP, type RiderInsightsDetailGroup } from '@/config/routes';
import { tDynamic } from '@/i18n/t-dynamic';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { RIDER_INSIGHTS_PAYWALL_ROW, type RiderInsightsPaywallRow } from '@/lib/paywall-surfaces';
import { presentRiderInsightsPaywall } from '@/lib/subscription';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { blurCaptureKey } from './blur-capture';
import { LockedRow, MINI_WIDTH, RowShell } from './locked-row';
import { buildInsightsPaywallCopy, insightsPaywallNumbers } from './paywall-copy';
import { fitViewport, routeSvgPath } from './region-tiles';
import {
  formatInsightDistance,
  type RiderInsightsData,
  type RiderInsightsRegion,
} from './use-rider-insights';

// ── Mini graphics ────────────────────────────────────────────────────────────

const BAND_HEIGHT = 10;
const BAND_SEAM = 1.5;
/** Ink strength of the four road bands, straight to tight. */
const BAND_ALPHAS = [0.16, 0.36, 0.62, 0.92] as const;
const GRID_CELL_HEIGHT = 4;
const GRID_SEAM = 2;
const GRID_LEVEL_ALPHAS = [0, 0.36, 0.62, 0.92] as const;
const GRID_MAX_LEVEL = 3;
const GRID_PARTS = 4;
const GRID_HEIGHT = GRID_PARTS * GRID_CELL_HEIGHT + (GRID_PARTS - 1) * GRID_SEAM;
const PATTERN_HEIGHT = 40;
const PATTERN_PADDING = 2;
const BLUR = { band: 4, grid: 3, pattern: 6 } as const;
const KM2_PER_MI2 = 2.589988;
/** A Monday, so `MONDAY + n days` names weekday n of the API's Monday-first grid. */
const MONDAY = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;
const DAY_PARTS = ['morning', 'afternoon', 'evening', 'night'] as const;
/** Bikes named in the row's value; the rest are on the detail page. */
const SHOWN_BIKES = 2;

type Bands = { straight: number; sweeping: number; twisty: number; tight: number };

function bandShares(bands: Bands): number[] {
  const values = [bands.straight, bands.sweeping, bands.twisty, bands.tight];
  const total = values.reduce((sum, v) => sum + v, 0);
  return total > 0 ? values.map((v) => v / total) : values.map(() => 0);
}

function BandBar({ shares }: { shares: readonly number[] }) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        width: MINI_WIDTH,
        height: BAND_HEIGHT,
        flexDirection: 'row',
        gap: BAND_SEAM,
        borderRadius: BAND_HEIGHT / 2,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      {shares.map((share, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: four fixed bands
          key={i}
          style={{ flex: share, backgroundColor: tint(t.ink, BAND_ALPHAS[i]) }}
        />
      ))}
    </View>
  );
}

/** Levels 0-3 from ride counts, by share of the busiest slot. */
export function gridLevels(grid: readonly (readonly number[])[]): number[][] {
  const max = Math.max(0, ...grid.flat());
  return grid.map((day) =>
    day.map((n) => (n <= 0 || max === 0 ? 0 : Math.ceil((n / max) * GRID_MAX_LEVEL))),
  );
}

function RhythmGrid({ levels }: { levels: readonly (readonly number[])[] }) {
  const { t } = useEditorialTheme();
  return (
    <View style={{ width: MINI_WIDTH, gap: GRID_SEAM }}>
      {DAY_PARTS.map((part, p) => (
        <View key={part} style={{ flexDirection: 'row', gap: GRID_SEAM }}>
          {levels.map((day, d) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed days
              key={d}
              style={{
                flex: 1,
                height: GRID_CELL_HEIGHT,
                borderRadius: 1,
                backgroundColor: day[p] > 0 ? tint(t.ink, GRID_LEVEL_ALPHAS[day[p]]) : t.surface2,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Territory's teaser: the free map's own routes as a pattern, no number. */
function TerritoryPattern({ region }: { region: RiderInsightsRegion | null }) {
  const { t } = useEditorialTheme();
  if (!region?.bounds || region.routes.length === 0) {
    return <View style={{ width: MINI_WIDTH, height: PATTERN_HEIGHT }} />;
  }
  const viewport = fitViewport(region.bounds, MINI_WIDTH, PATTERN_HEIGHT, PATTERN_PADDING);
  return (
    <Svg width={MINI_WIDTH} height={PATTERN_HEIGHT}>
      {region.routes.map((route, i) => (
        <Path
          // biome-ignore lint/suspicious/noArrayIndexKey: routes are an ordered, unkeyed list
          key={i}
          d={routeSvgPath(route, viewport, MINI_WIDTH, PATTERN_HEIGHT)}
          stroke={t.ink3}
          strokeWidth={1}
          fill="none"
        />
      ))}
    </Svg>
  );
}

// ── Value text ───────────────────────────────────────────────────────────────

/** The busiest weekday and day part: "Sunday mornings". Earliest wins a tie. */
export function busiestSlot(
  grid: readonly (readonly number[])[],
  t: TFunction,
  language: string,
): string | null {
  let best = { day: -1, part: -1, n: 0 };
  for (let day = 0; day < grid.length; day += 1) {
    for (let part = 0; part < grid[day].length; part += 1) {
      if (grid[day][part] > best.n) best = { day, part, n: grid[day][part] };
    }
  }
  if (best.n === 0) return null;
  const weekday = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(MONDAY + best.day * DAY_MS),
  );
  return tDynamic(t, `riderInsights.howYouRide.rhythm.slot.${DAY_PARTS[best.part]}`, {
    day: weekday,
  });
}

// ── Rows ─────────────────────────────────────────────────────────────────────

interface HowYouRideListProps {
  insights: RiderInsightsData;
  /** The region on the main map, whose routes pattern Territory's teaser. */
  mainRegion: RiderInsightsRegion | null;
  unlocking: boolean;
  system: MeasurementSystem;
  onPurchased: () => void;
  onOpenDetail: (group: RiderInsightsDetailGroup) => void;
}

/** "How you ride": one row per insight, each drawn by its status. */
export function HowYouRideList({
  insights,
  mainRegion,
  unlocking,
  system,
  onPurchased,
  onOpenDetail,
}: HowYouRideListProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t, isDark } = useEditorialTheme();
  const { fontScale } = useWindowDimensions();
  const language = instance.language;
  const shownRows = useRef(new Set<RiderInsightsPaywallRow>());
  const dist = (m: number) => formatInsightDistance(m, system, language);
  const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 });

  const onShown = useCallback((row: RiderInsightsPaywallRow) => {
    if (shownRows.current.has(row)) return;
    shownRows.current.add(row);
    trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_SHOWN, { row });
  }, []);

  const unlock = useCallback(
    async (row: RiderInsightsPaywallRow) => {
      trackEvent(AnalyticsEvent.RIDER_INSIGHTS_LOCKED_ROW_TAPPED, { row });
      const copy = buildInsightsPaywallCopy(row, insightsPaywallNumbers(insights), {
        t: i18n,
        system,
        language,
      });
      const result = await presentRiderInsightsPaywall(row, copy);
      if (result === 'purchased' || result === 'restored') onPurchased();
    },
    [insights, i18n, system, language, onPurchased],
  );

  const chevron = <ChevronRight size={16} color={t.ink4} strokeWidth={2.4} />;

  /** A row with a title and one line of state text, no number and no tap. */
  const stateRow = (id: string, title: string, line: string) => (
    <RowShell testID={`${id}-row`} accessibilityLabel={`${title}. ${line}`}>
      <Text style={[type.body, { color: t.ink }]}>{title}</Text>
      <Text style={[type.subhead, { color: t.ink2 }]}>{line}</Text>
    </RowShell>
  );

  const readyRow = (
    id: string,
    group: RiderInsightsDetailGroup,
    title: string,
    value: string,
    caption: string | null,
    graphic?: ReactNode,
    graphicLabel?: string,
  ) => (
    <RowShell
      testID={`${id}-row`}
      accessibilityLabel={[title, value, caption, graphicLabel].filter(Boolean).join('. ')}
      onPress={() => onOpenDetail(group)}
      graphic={graphic ? <View accessibilityElementsHidden>{graphic}</View> : undefined}
      trailing={chevron}
    >
      <Text style={[type.body, { color: t.ink }]}>{title}</Text>
      <Text style={[type.figureSmall, { color: t.ink }]}>{value}</Text>
      {caption ? <Text style={[type.caption, { color: t.ink3 }]}>{caption}</Text> : null}
    </RowShell>
  );

  /** Shared states of a Pro group; null when the group is ready or locked. */
  const proState = (id: string, title: string, status: RiderInsightsStatus, missing: string) => {
    if (status === RiderInsightsStatus.NotEnough)
      return stateRow(id, title, i18n('riderInsights.howYouRide.keepRiding'));
    if (status === RiderInsightsStatus.Computing)
      return stateRow(id, title, i18n('riderInsights.howYouRide.computing'));
    if (status === RiderInsightsStatus.MissingInput) return stateRow(id, title, missing);
    return null;
  };

  const locked = (
    id: string,
    row: RiderInsightsPaywallRow,
    title: string,
    teaser: string,
    graphic: ReactNode,
    graphicHeight: number,
    blurRadius: number,
    data: unknown,
  ) => (
    <LockedRow
      testID={`${id}-row`}
      title={title}
      teaser={teaser}
      graphic={graphic}
      graphicHeight={graphicHeight}
      blurRadius={blurRadius}
      captureKey={blurCaptureKey({ row, data, isDark, fontScale })}
      unlocking={unlocking}
      onShown={() => onShown(row)}
      onUnlock={() => void unlock(row)}
    />
  );

  // Road character
  const rc = insights.roadCharacter;
  const rcTitle = i18n('riderInsights.howYouRide.roadCharacter.title');
  const roadCharacter =
    proState('road-character', rcTitle, rc.status, i18n('riderInsights.howYouRide.missingRoute')) ??
    (rc.status === RiderInsightsStatus.Locked
      ? locked(
          'road-character',
          RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER,
          rcTitle,
          i18n('riderInsights.howYouRide.roadCharacter.teaser'),
          <BandBar shares={rc.teaser ? bandShares(rc.teaser.bandShares) : [1, 0, 0, 0]} />,
          BAND_HEIGHT,
          BLUR.band,
          rc.teaser,
        )
      : rc.detail
        ? (() => {
            const shares = bandShares(rc.detail.bandKm);
            const [straight, sweeping, twisty, tight] = shares.map((s) => percent.format(s));
            return readyRow(
              'road-character',
              RIDER_INSIGHTS_DETAIL_GROUP.ROAD_CHARACTER,
              rcTitle,
              i18n('riderInsights.howYouRide.roadCharacter.value', {
                share: percent.format(shares[2] + shares[3]),
              }),
              rc.detail.lean
                ? i18n('riderInsights.howYouRide.roadCharacter.withLean')
                : rc.detail.bendsPer10km !== null
                  ? i18n('riderInsights.howYouRide.roadCharacter.bends', {
                      bends: Math.round(rc.detail.bendsPer10km),
                    })
                  : null,
              <BandBar shares={shares} />,
              i18n('riderInsights.howYouRide.roadCharacter.a11y', {
                straight,
                sweeping,
                twisty,
                tight,
              }),
            );
          })()
        : stateRow('road-character', rcTitle, i18n('riderInsights.howYouRide.computing')));

  // Territory
  const tr = insights.territory;
  const trTitle = i18n('riderInsights.howYouRide.territory.title');
  const territory =
    proState('territory', trTitle, tr.status, i18n('riderInsights.howYouRide.missingRoute')) ??
    (tr.status === RiderInsightsStatus.Locked
      ? locked(
          'territory',
          RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY,
          trTitle,
          i18n('riderInsights.howYouRide.territory.teaser'),
          <TerritoryPattern region={mainRegion} />,
          PATTERN_HEIGHT,
          BLUR.pattern,
          [mainRegion?.key, mainRegion?.routes.length],
        )
      : tr.detail
        ? (() => {
            const imperial = system === 'imperial';
            const area = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(
              imperial ? tr.detail.exploredKm2 / KM2_PER_MI2 : tr.detail.exploredKm2,
            );
            const areaText = `${area} ${imperial ? 'mi²' : 'km²'}`;
            return readyRow(
              'territory',
              RIDER_INSIGHTS_DETAIL_GROUP.TERRITORY,
              trTitle,
              tr.detail.newRoadShare === null
                ? areaText
                : i18n('riderInsights.howYouRide.territory.value', {
                    area: areaText,
                    share: percent.format(tr.detail.newRoadShare),
                  }),
              tr.detail.furthest
                ? i18n('riderInsights.howYouRide.territory.furthest', {
                    distance: dist(tr.detail.furthest.distanceM),
                  })
                : null,
            );
          })()
        : stateRow('territory', trTitle, i18n('riderInsights.howYouRide.computing')));

  // Rhythm
  const rh = insights.rhythm;
  const rhTitle = i18n('riderInsights.howYouRide.rhythm.title');
  const rhythm =
    proState('rhythm', rhTitle, rh.status, i18n('riderInsights.howYouRide.rhythm.missing')) ??
    (rh.status === RiderInsightsStatus.Locked
      ? locked(
          'rhythm',
          RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM,
          rhTitle,
          i18n('riderInsights.howYouRide.rhythm.teaser'),
          <RhythmGrid levels={rh.teaser?.grid ?? []} />,
          GRID_HEIGHT,
          BLUR.grid,
          rh.teaser,
        )
      : rh.detail
        ? (() => {
            const slot = busiestSlot(rh.detail.grid, i18n, language);
            return readyRow(
              'rhythm',
              RIDER_INSIGHTS_DETAIL_GROUP.RHYTHM,
              rhTitle,
              slot ?? i18n('riderInsights.howYouRide.keepRiding'),
              i18n('riderInsights.howYouRide.rhythm.weekend', {
                count: rh.detail.rides,
                weekend: rh.detail.weekendRides,
              }),
              <RhythmGrid levels={gridLevels(rh.detail.grid)} />,
              slot ? i18n('riderInsights.howYouRide.rhythm.a11y', { slot }) : undefined,
            );
          })()
        : stateRow('rhythm', rhTitle, i18n('riderInsights.howYouRide.computing')));

  // Best rides: the longest ride is free; the ranking is Pro.
  const br = insights.bestRides;
  const longest = insights.longestRide;
  const isPro = br.status === RiderInsightsStatus.Ready;
  const brTitle = isPro
    ? i18n('riderInsights.howYouRide.bestRides.title')
    : i18n('riderInsights.howYouRide.bestRides.titleFree');
  const bestRides =
    proState('best-rides', brTitle, br.status, i18n('riderInsights.howYouRide.computing')) ??
    (longest
      ? readyRow(
          'best-rides',
          RIDER_INSIGHTS_DETAIL_GROUP.BEST_RIDES,
          brTitle,
          i18n('riderInsights.howYouRide.bestRides.value', {
            name:
              longest.name ??
              i18n('riderInsights.howYouRide.bestRides.unnamed', {
                date: shortDate(longest.localDate, language),
              }),
            distance: dist(longest.distanceM),
          }),
          isPro
            ? i18n('riderInsights.howYouRide.bestRides.captionPro', {
                date: shortDate(longest.localDate, language),
              })
            : i18n('riderInsights.howYouRide.bestRides.captionFree', {
                date: shortDate(longest.localDate, language),
              }),
        )
      : stateRow('best-rides', brTitle, i18n('riderInsights.howYouRide.computing')));

  // Bikes (free)
  const bk = insights.bikes;
  const bkTitle = i18n('riderInsights.howYouRide.bikes.title');
  const bikes = (() => {
    if (bk.status === RiderInsightsStatus.MissingInput) {
      return stateRow('bikes', bkTitle, i18n('riderInsights.howYouRide.bikes.missing'));
    }
    const items = bk.items ?? [];
    const assigned = items
      .filter((item) => item.motorcycleId !== null)
      .sort((a, b) => b.distanceM - a.distanceM);
    if (bk.status !== RiderInsightsStatus.Ready || assigned.length === 0) {
      return stateRow('bikes', bkTitle, i18n('riderInsights.howYouRide.computing'));
    }
    const unassigned = items.find((item) => item.motorcycleId === null)?.rides ?? 0;
    const name = (item: (typeof assigned)[number]) =>
      item.name ?? i18n('riderInsights.howYouRide.bikes.unnamed');
    return readyRow(
      'bikes',
      RIDER_INSIGHTS_DETAIL_GROUP.BIKES,
      bkTitle,
      assigned
        .slice(0, SHOWN_BIKES)
        .map((item) =>
          i18n('riderInsights.howYouRide.bikes.item', {
            name: name(item),
            distance: dist(item.distanceM),
          }),
        )
        .join(' · '),
      [
        i18n('riderInsights.howYouRide.bikes.count', { count: assigned.length }),
        unassigned > 0
          ? i18n('riderInsights.howYouRide.bikes.unassigned', { count: unassigned })
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    );
  })();

  const rows = [roadCharacter, territory, rhythm, bestRides, bikes];

  return (
    <View style={{ gap: space.xs }}>
      <Text
        accessibilityRole="header"
        style={[type.label, { color: t.ink3, marginHorizontal: space.md }]}
      >
        {i18n('riderInsights.howYouRide.section')}
      </Text>
      <View
        style={{
          backgroundColor: t.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: five fixed rows in a fixed order
          <Fragment key={i}>
            {i > 0 ? (
              <View style={{ height: 1, marginLeft: space.md, backgroundColor: t.line }} />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

function shortDate(isoDate: string, language: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  );
}
