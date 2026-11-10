import {
  type MeasurementSystem,
  metersToUnit,
  mileageUnitLabel,
  type RiderInsights,
} from '@motovault/types';
import type { TFunction } from 'i18next';
import { RIDER_INSIGHTS_PAYWALL_ROW, type RiderInsightsPaywallRow } from '@/lib/paywall-surfaces';

/**
 * The free numbers the paywall copy may quote. Never a locked group's value: a
 * free rider must not learn a Pro number from the paywall. Null when the number
 * is not known, which shows the row's default headline instead.
 */
export interface InsightsPaywallNumbers {
  seasonDistanceM: number | null;
  seasonRides: number | null;
  longestRideM: number | null;
}

export interface InsightsPaywallCopy {
  headline: string;
  subhead: string;
}

interface CopyContext {
  t: TFunction;
  system: MeasurementSystem;
  /** The app language, for digit grouping ("1,330" in English, "1.330" in German). */
  language: string;
}

/** The free numbers from a Rider insights response. */
export function insightsPaywallNumbers(
  insights: Pick<RiderInsights, 'totals' | 'longestRide'>,
): InsightsPaywallNumbers {
  return {
    seasonDistanceM: insights.totals.distanceM,
    seasonRides: insights.totals.rides,
    longestRideM: insights.longestRide?.distanceM ?? null,
  };
}

/** A distance in the rider's unit, whole, grouped for their language: "1,330 mi". */
function formatWholeDistance(meters: number, { system, language }: CopyContext): string {
  const unit = mileageUnitLabel(system);
  const value = new Intl.NumberFormat(language, { maximumFractionDigits: 0 }).format(
    metersToUnit(meters, unit),
  );
  return `${value} ${unit}`;
}

function seasonDistance(numbers: InsightsPaywallNumbers, ctx: CopyContext): string | null {
  if (numbers.seasonDistanceM === null) return null;
  return ctx.t('riderInsightsPaywall.seasonDistance', {
    distance: formatWholeDistance(numbers.seasonDistanceM, ctx),
  });
}

interface RowCopy {
  /** The headline from a free number, or null when that number is missing. */
  headline: (numbers: InsightsPaywallNumbers, ctx: CopyContext) => string | null;
  headlineDefault: (t: TFunction) => string;
  subhead: (ctx: CopyContext) => string;
}

const ROW_COPY: Record<RiderInsightsPaywallRow, RowCopy> = {
  [RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY]: {
    headline: seasonDistance,
    headlineDefault: (t) => t('riderInsightsPaywall.territory.headlineDefault'),
    subhead: ({ t }) => t('riderInsightsPaywall.territory.subhead'),
  },
  [RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER]: {
    headline: seasonDistance,
    headlineDefault: (t) => t('riderInsightsPaywall.roadCharacter.headlineDefault'),
    subhead: ({ t }) => t('riderInsightsPaywall.roadCharacter.subhead'),
  },
  [RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM]: {
    headline: (numbers, { t }) =>
      numbers.seasonRides === null
        ? null
        : t('riderInsightsPaywall.seasonRides', { count: numbers.seasonRides }),
    headlineDefault: (t) => t('riderInsightsPaywall.rhythm.headlineDefault'),
    subhead: ({ t }) => t('riderInsightsPaywall.rhythm.subhead'),
  },
  [RIDER_INSIGHTS_PAYWALL_ROW.BEST_RIDES]: {
    headline: (numbers, ctx) =>
      numbers.longestRideM === null
        ? null
        : ctx.t('riderInsightsPaywall.longestRide', {
            distance: formatWholeDistance(numbers.longestRideM, ctx),
          }),
    headlineDefault: (t) => t('riderInsightsPaywall.bestRides.headlineDefault'),
    subhead: ({ t }) => t('riderInsightsPaywall.bestRides.subhead'),
  },
  [RIDER_INSIGHTS_PAYWALL_ROW.SUMMARY]: {
    headline: seasonDistance,
    headlineDefault: (t) => t('riderInsightsPaywall.summary.headlineDefault'),
    subhead: ({ t }) => t('riderInsightsPaywall.summary.subhead'),
  },
  [RIDER_INSIGHTS_PAYWALL_ROW.COST]: {
    headline: seasonDistance,
    headlineDefault: (t) => t('riderInsightsPaywall.cost.headlineDefault'),
    subhead: ({ t, system }) =>
      t('riderInsightsPaywall.cost.subhead', { unit: mileageUnitLabel(system) }),
  },
};

/**
 * The paywall headline and subhead for a locked row, in the rider's units and
 * language. For the ride-summary card, pass the season distance after that ride.
 */
export function buildInsightsPaywallCopy(
  row: RiderInsightsPaywallRow,
  numbers: InsightsPaywallNumbers,
  ctx: CopyContext,
): InsightsPaywallCopy {
  const copy = ROW_COPY[row];
  return {
    headline: copy.headline(numbers, ctx) ?? copy.headlineDefault(ctx.t),
    subhead: copy.subhead(ctx),
  };
}
