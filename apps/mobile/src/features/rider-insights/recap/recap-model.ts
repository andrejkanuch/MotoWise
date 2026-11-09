/**
 * The season recap's data: seven story cards, three free (distance and rides,
 * countries, longest ride) and four Pro (rhythm, new roads, twistiest ride,
 * cost of riding), each drawn by its state. Pure, so the cards stay thin.
 */
import { RiderInsightsStatus } from '@motovault/graphql';
import {
  type MeasurementSystem,
  type MileageUnit,
  metersToUnit,
  mileageUnitLabel,
} from '@motovault/types';
import type { RiderInsightsData } from '../use-rider-insights';

export const RECAP_CARD = {
  DISTANCE: 'distance',
  COUNTRIES: 'countries',
  LONGEST: 'longest',
  RHYTHM: 'rhythm',
  NEW_ROADS: 'new-roads',
  TWISTIEST: 'twistiest',
  COST: 'cost',
} as const;
export type RecapCard = (typeof RECAP_CARD)[keyof typeof RECAP_CARD];

export const RECAP_TIER = { FREE: 'free', PRO: 'pro' } as const;
export type RecapTier = (typeof RECAP_TIER)[keyof typeof RECAP_TIER];

export const RECAP_STATE = {
  READY: 'ready',
  /** A Pro card for a rider without Pro: its title over a blur. */
  LOCKED: 'locked',
  /** Under five qualifying rides: keep riding, no blur, no paywall. */
  NOT_ENOUGH: 'notEnough',
  COMPUTING: 'computing',
  MISSING: 'missing',
} as const;
export type RecapState = (typeof RECAP_STATE)[keyof typeof RECAP_STATE];

export interface RecapCardState {
  card: RecapCard;
  tier: RecapTier;
  state: RecapState;
}

const STATE_BY_STATUS: Record<RiderInsightsStatus, RecapState> = {
  [RiderInsightsStatus.Ready]: RECAP_STATE.READY,
  [RiderInsightsStatus.Locked]: RECAP_STATE.LOCKED,
  [RiderInsightsStatus.NotEnough]: RECAP_STATE.NOT_ENOUGH,
  [RiderInsightsStatus.Computing]: RECAP_STATE.COMPUTING,
  [RiderInsightsStatus.MissingInput]: RECAP_STATE.MISSING,
};

/** A Pro card's state; a "ready" group without the card's value has nothing to show. */
function proState(status: RiderInsightsStatus, hasValue: boolean): RecapState {
  const state = STATE_BY_STATUS[status];
  return state === RECAP_STATE.READY && !hasValue ? RECAP_STATE.MISSING : state;
}

/** The seven cards in order, each with what it can show this rider. */
export function recapCards(insights: RiderInsightsData): RecapCardState[] {
  const free = (card: RecapCard, state: RecapState) => ({ card, tier: RECAP_TIER.FREE, state });
  const pro = (card: RecapCard, state: RecapState) => ({ card, tier: RECAP_TIER.PRO, state });
  const pending = insights.coverage.pendingRides > 0;

  return [
    free(RECAP_CARD.DISTANCE, RECAP_STATE.READY),
    free(
      RECAP_CARD.COUNTRIES,
      insights.countries.length > 0
        ? RECAP_STATE.READY
        : pending
          ? RECAP_STATE.COMPUTING
          : RECAP_STATE.MISSING,
    ),
    free(RECAP_CARD.LONGEST, insights.longestRide ? RECAP_STATE.READY : RECAP_STATE.COMPUTING),
    pro(RECAP_CARD.RHYTHM, proState(insights.rhythm.status, insights.rhythm.detail !== null)),
    pro(
      RECAP_CARD.NEW_ROADS,
      proState(insights.territory.status, insights.territory.detail !== null),
    ),
    pro(
      RECAP_CARD.TWISTIEST,
      proState(
        insights.roadCharacter.status,
        (insights.roadCharacter.detail?.twistiest.length ?? 0) > 0,
      ),
    ),
    pro(
      RECAP_CARD.COST,
      proState(insights.costPerKm.status, (insights.costPerKm.items?.length ?? 0) > 0),
    ),
  ];
}

/** The calendar year of the season the API chose: last year until the new one has five qualifying rides. */
export function recapSeasonYear(insights: RiderInsightsData): number {
  return Number(insights.season.from.slice(0, 4));
}

// ── Cost of riding ───────────────────────────────────────────────────────────

type CostItem = NonNullable<RiderInsightsData['costPerKm']['items']>[number];

export interface CostLine {
  currency: string;
  /** Spend per km or mile; null when no distance was ridden. */
  perUnit: number | null;
  /** What the spend was divided by: odometer, tracked or mixed. */
  source: string;
}

export interface CostOfRiding {
  unit: MileageUnit;
  /** The currency with the most spend this season. */
  main: CostLine;
  /** Every other currency, most spend first. */
  others: CostLine[];
}

/**
 * Fuel and service spend per km (or mile) in each currency, led by the one
 * with the most spend. Null with no rows.
 */
export function costOfRiding(
  items: readonly CostItem[] | null,
  system: MeasurementSystem,
): CostOfRiding | null {
  if (!items || items.length === 0) return null;
  const unit = mileageUnitLabel(system);
  const lines = [...items]
    .sort((a, b) => b.spend - a.spend)
    .map((item) => {
      const distance = metersToUnit(item.distanceM, unit);
      return {
        currency: item.currency,
        perUnit: distance > 0 ? item.spend / distance : null,
        source: item.distanceSource,
      };
    });
  return { unit, main: lines[0], others: lines.slice(1) };
}

/** `€0.14/km`, in the rider's language. */
export function formatCostPerUnit(
  perUnit: number,
  currency: string,
  unit: MileageUnit,
  language: string,
): string {
  const money = new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(perUnit);
  return `${money}/${unit}`;
}

// ── Rhythm ───────────────────────────────────────────────────────────────────

/** The API's day parts, as the local start hours each one spans. */
export const DAY_PART_HOURS = [
  { from: '05', to: '12' },
  { from: '12', to: '17' },
  { from: '17', to: '22' },
  { from: '22', to: '05' },
] as const;

/** Rides in the busiest weekday and day part, and that part's index. Earliest wins a tie. */
export function busiestCell(
  grid: readonly (readonly number[])[],
): { day: number; part: number; rides: number } | null {
  let best = { day: -1, part: -1, rides: 0 };
  grid.forEach((parts, day) => {
    parts.forEach((rides, part) => {
      if (rides > best.rides) best = { day, part, rides };
    });
  });
  return best.rides > 0 ? best : null;
}
