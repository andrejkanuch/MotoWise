import type { MeasurementSystem } from '@motovault/types';
import { RIDER_INSIGHTS_DETAIL_GROUP, type RiderInsightsDetailGroup } from '@/config/routes';
import { RIDER_INSIGHTS_PAYWALL_ROW, type RiderInsightsPaywallRow } from '@/lib/paywall-surfaces';
import { elevationUnitLabel, formatElevationValue } from '@/utils/ride-formatters';

const KM2_PER_MI2 = 2.589988;
const GROUPS: ReadonlySet<string> = new Set(Object.values(RIDER_INSIGHTS_DETAIL_GROUP));

/** The detail group a route param names, or null for anything else (a stale or mistyped link). */
export function detailGroupFrom(
  param: string | string[] | undefined,
): RiderInsightsDetailGroup | null {
  const value = Array.isArray(param) ? param[0] : param;
  return value && GROUPS.has(value) ? (value as RiderInsightsDetailGroup) : null;
}

/** The paywall row a Pro detail page unlocks; free pages have none. */
export const PAYWALL_ROW_BY_GROUP: Partial<
  Record<RiderInsightsDetailGroup, RiderInsightsPaywallRow>
> = {
  [RIDER_INSIGHTS_DETAIL_GROUP.ROAD_CHARACTER]: RIDER_INSIGHTS_PAYWALL_ROW.ROAD_CHARACTER,
  [RIDER_INSIGHTS_DETAIL_GROUP.TERRITORY]: RIDER_INSIGHTS_PAYWALL_ROW.TERRITORY,
  [RIDER_INSIGHTS_DETAIL_GROUP.RHYTHM]: RIDER_INSIGHTS_PAYWALL_ROW.RHYTHM,
  [RIDER_INSIGHTS_DETAIL_GROUP.BEST_RIDES]: RIDER_INSIGHTS_PAYWALL_ROW.BEST_RIDES,
};

/** Each value's share of the total, 0 when there is nothing to share. */
export function sharesOf(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  return total > 0 ? values.map((v) => v / total) : values.map(() => 0);
}

/** `26%` in the rider's language. */
export function formatPercent(share: number, language: string): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(
    share,
  );
}

/** A plain grouped number: `1,940`, or `20.8` with `fractionDigits: 1`. */
export function formatNumber(value: number, language: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Explored area in the rider's unit: `343 km²` or `132 mi²`. */
export function formatArea(km2: number, system: MeasurementSystem, language: string): string {
  const imperial = system === 'imperial';
  const value = formatNumber(imperial ? km2 / KM2_PER_MI2 : km2, language);
  return `${value} ${imperial ? 'mi²' : 'km²'}`;
}

/** Climb in the rider's unit, grouped: `1,311 m` or `4,301 ft`. */
export function formatClimb(meters: number, system: MeasurementSystem, language: string): string {
  return `${formatNumber(formatElevationValue(meters, system), language)} ${elevationUnitLabel(system)}`;
}

/** `10 Oct` for a local `yyyy-MM-dd` date, in the rider's language. */
export function shortDate(isoDate: string, language: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  );
}

/** Lean bands in display order. The shares are what the page shows: never one degree value. */
export const LEAN_BANDS = ['under20', 'from20to30', 'from30to40', 'from40'] as const;
export type LeanBand = (typeof LEAN_BANDS)[number];
