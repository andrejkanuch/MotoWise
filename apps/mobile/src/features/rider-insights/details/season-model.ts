import { type MyRidesQuery, RideStatus } from '@motovault/graphql';
import {
  addDays,
  addMonths,
  format,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { seasonEndSoFar, summarizeRibbon } from '../season-ribbon';
import type { RiderInsightsData } from '../use-rider-insights';

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
const DAYS_PER_WEEK = 7;
/** A Monday-start week's Thursday: the day that decides which month the week counts in. */
const THURSDAY_OFFSET = 3;
const ISO_DAY = 'yyyy-MM-dd';
const ISO_MONTH = 'yyyy-MM';

export type MyRide = MyRidesQuery['myRides']['edges'][number]['node'];

export interface SeasonMonth {
  /** `yyyy-MM` */
  month: string;
  distanceM: number;
  rides: number;
}

export interface SeasonWeek {
  /** The week's Monday, `yyyy-MM-dd`. */
  weekStart: string;
  distanceM: number;
  rides: number;
  biggest: boolean;
}

/**
 * The month a week counts in: the one holding its Thursday, so a week falls in
 * the month most of its days are in (as ISO weeks count years).
 */
export function monthOfWeek(weekStart: string): string {
  return format(addDays(parseISO(weekStart), THURSDAY_OFFSET), ISO_MONTH);
}

/**
 * The season's months so far, newest first, each with the distance and rides
 * of the weeks counted in it. Months without a ride stay in the list with
 * zeros so the gaps read as gaps. A week whose Thursday lies outside the season
 * counts in the nearest month of it.
 */
export function seasonMonths(
  ribbon: RiderInsightsData['ribbon'],
  season: RiderInsightsData['season'],
  today: string = format(new Date(), ISO_DAY),
): SeasonMonth[] {
  const first = startOfMonth(parseISO(season.from));
  const last = startOfMonth(parseISO(seasonEndSoFar(season, today)));
  const months: SeasonMonth[] = [];
  for (let month = first; !isBefore(last, month); month = addMonths(month, 1)) {
    months.push({ month: format(month, ISO_MONTH), distanceM: 0, rides: 0 });
  }
  if (months.length === 0) return [];
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const firstKey = months[0].month;
  const lastKey = months[months.length - 1].month;

  for (const week of ribbon) {
    const key = monthOfWeek(week.weekStart);
    const clamped = key < firstKey ? firstKey : key > lastKey ? lastKey : key;
    const month = byMonth.get(clamped);
    if (!month) continue;
    month.distanceM += week.distanceM;
    month.rides += week.rides;
  }
  return months.reverse();
}

/** Every week ridden this season, newest first, the biggest one marked. */
export function seasonWeeks(
  ribbon: RiderInsightsData['ribbon'],
  season: RiderInsightsData['season'],
  today: string = format(new Date(), ISO_DAY),
): SeasonWeek[] {
  const { slots, biggest } = summarizeRibbon(ribbon, season, today);
  return slots
    .filter((slot) => slot.rides > 0)
    .map((slot) => ({
      weekStart: slot.weekStart,
      distanceM: slot.distanceM,
      rides: slot.rides,
      biggest: slot.weekStart === biggest?.weekStart,
    }))
    .reverse();
}

/** A week from its Monday's local midnight to the next Monday's, end excluded. */
export function weekBounds(weekStart: string): { start: Date; end: Date } {
  const start = startOfWeek(parseISO(weekStart), WEEK_OPTIONS);
  return { start, end: addDays(start, DAYS_PER_WEEK) };
}

/**
 * Whether the loaded rides may still miss some of the week: more pages exist
 * and no loaded ride started before the week's Monday. The list is newest
 * first, so once one ride is older than the week every ride of it is in hand.
 */
export function needsOlderRides(
  rides: readonly MyRide[],
  weekStart: string,
  hasNextPage: boolean,
): boolean {
  if (!hasNextPage) return false;
  const { start } = weekBounds(weekStart);
  return !rides.some((ride) => isBefore(parseISO(ride.startedAt), start));
}

/** The finished rides that started in the week, in the rider's local time, oldest first. */
export function ridesInWeek(rides: readonly MyRide[], weekStart: string): MyRide[] {
  const { start, end } = weekBounds(weekStart);
  return rides
    .filter((ride) => {
      if (ride.status !== RideStatus.Completed) return false;
      const started = parseISO(ride.startedAt);
      return !isBefore(started, start) && isBefore(started, end);
    })
    .sort((a, b) => parseISO(a.startedAt).getTime() - parseISO(b.startedAt).getTime());
}
