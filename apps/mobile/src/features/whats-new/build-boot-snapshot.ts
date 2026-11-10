import {
  type ExpensesByMotorcycleQuery,
  type MyMotorcyclesQuery,
  type MyRidesQuery,
  type NotesByMotorcycleQuery,
  RiderInsightsStatus,
} from '@motovault/graphql';
import {
  type Currency,
  type MeasurementSystem,
  metersToUnit,
  mileageUnitLabel,
} from '@motovault/types';
import { subDays } from 'date-fns';
import {
  WHATS_NEW_DATA_KIND,
  WHATS_NEW_FEATURE,
  type WhatsNewFeature,
} from '@/data/whats-new-releases';
import type { RiderInsightsData } from '@/features/rider-insights/use-rider-insights';
import { distanceParts } from '@/features/rider-insights/use-rider-insights';
import type { HubUnit } from '@/lib/bike-hub/constants';
import { formatOdometer, formatShortDate, hasOdometer, toHubUnit } from '@/lib/bike-hub/format';
import { formatCurrency, formatMoney } from '@/lib/expense-constants';
import { flattenExpenses } from '@/lib/find-expense-in-cache';
import { numberLocaleFor } from '@/lib/number-locale';
import { decodePolylineLatLng } from '@/utils/polyline';
import { selectPrimaryBike } from '@/utils/primary-bike';
import {
  EXAMPLE_RECEIPT_CATEGORY,
  EXAMPLE_RECEIPT_DAYS_AGO,
  EXAMPLE_ROUTES,
  EXAMPLE_TIRE_PRESSURE,
  exampleFuelFill,
  type RoutePath,
} from './whats-new-examples';

/** Where a page's data came from. */
export const WHATS_NEW_DATA_SOURCE = {
  /** Read from the query cache when What's New opened. */
  CACHE: 'cache',
  /** Fetched while What's New was open, inside the time budget. */
  FETCHED: 'fetched',
  /** The fetch failed, ran out of time, or had not landed when the page was first viewed. */
  TIMED_OUT: 'timed_out',
  /** The rider has no such data (or nothing could be asked for it). */
  NONE: 'none',
} as const;

export type WhatsNewDataSource = (typeof WHATS_NEW_DATA_SOURCE)[keyof typeof WHATS_NEW_DATA_SOURCE];

/** What the boot's odometer rolls to. */
export const BOOT_KIND = {
  /** The season distance, in the rider's unit. */
  SEASON: 'season',
  /** The primary bike's odometer, in the bike's own unit. */
  ODO: 'odo',
  /** Nothing to show: the odometer is left out. */
  NONE: 'none',
} as const;

/** Which Road Atlas line fits the rider's data. */
export const ATLAS_LINE = {
  SEASON: 'season',
  SEASON_WITH_SHARE: 'season_with_share',
  /** Routes exist but the season has no distance yet (early January). */
  LAST_RIDES: 'last_rides',
} as const;

export type AtlasLine = (typeof ATLAS_LINE)[keyof typeof ATLAS_LINE];

type Bike = MyMotorcyclesQuery['myMotorcycles'][number];
type Note = NotesByMotorcycleQuery['notes'][number];
type YourData = typeof WHATS_NEW_DATA_KIND.YOUR_DATA;
type Example = typeof WHATS_NEW_DATA_KIND.EXAMPLE;

export type BootData =
  | {
      kind: typeof BOOT_KIND.SEASON;
      /** The number the odometer rolls to, whole units. */
      value: number;
      figure: string;
      unitLabel: string;
      rides: number;
    }
  | {
      kind: typeof BOOT_KIND.ODO;
      value: number;
      figure: string;
      unitLabel: HubUnit;
      bikeName: string;
    }
  | { kind: typeof BOOT_KIND.NONE };

export type AtlasPageData =
  | {
      feature: typeof WHATS_NEW_FEATURE.ROAD_ATLAS;
      kind: YourData;
      source: WhatsNewDataSource;
      line: AtlasLine;
      /** "2,507 km"; null on the last-rides line. */
      distance: string | null;
      /** Season rides, or the number of routes drawn on the last-rides line. */
      rides: number;
      /** "84%", only when Territory is unlocked. */
      newRoadShare: string | null;
      routes: readonly RoutePath[];
    }
  | {
      feature: typeof WHATS_NEW_FEATURE.ROAD_ATLAS;
      kind: Example;
      source: WhatsNewDataSource;
      routes: readonly RoutePath[];
      unitLabel: string;
      /** The rider's season when they ride but no ride has a GPS route to draw. */
      season: { distance: string; rides: number } | null;
    };

export type ScanPageData =
  | {
      feature: typeof WHATS_NEW_FEATURE.RECEIPT_SCAN;
      kind: YourData;
      source: WhatsNewDataSource;
      expenseId: string;
      /** The description, else the item name, else the category label. */
      place: string;
      /** In the expense's own currency. */
      amount: string;
      date: string;
      category: string;
    }
  | {
      feature: typeof WHATS_NEW_FEATURE.RECEIPT_SCAN;
      kind: Example;
      source: WhatsNewDataSource;
      currency: Currency;
      amount: string;
      date: string;
      category: typeof EXAMPLE_RECEIPT_CATEGORY;
    };

export type NotesPageData =
  | {
      feature: typeof WHATS_NEW_FEATURE.NOTES_PHOTOS;
      kind: YourData;
      source: WhatsNewDataSource;
      noteId: string;
      /** The note's first non-empty line. */
      text: string;
      hasPhoto: boolean;
    }
  | {
      feature: typeof WHATS_NEW_FEATURE.NOTES_PHOTOS;
      kind: Example;
      source: WhatsNewDataSource;
      /** Nickname, else make and model; null without a bike ("your bike" in copy). */
      bikeName: string | null;
      front: string;
      rear: string;
    };

export interface WhatsNewPageDataMap {
  [WHATS_NEW_FEATURE.ROAD_ATLAS]: AtlasPageData;
  [WHATS_NEW_FEATURE.RECEIPT_SCAN]: ScanPageData;
  [WHATS_NEW_FEATURE.NOTES_PHOTOS]: NotesPageData;
}

export type WhatsNewPageData = WhatsNewPageDataMap[WhatsNewFeature];

export interface BootSnapshot {
  boot: BootData;
  pages: WhatsNewPageDataMap;
  /** Features the rider already uses, merged into "used" before pages are chosen. */
  priorUse: WhatsNewFeature[];
}

/** A read that may have come from the cache or a fetch; `source` says which. */
export interface SourcedRead<T> {
  data: T | null;
  source: WhatsNewDataSource;
}

export interface SnapshotPrefs {
  measurementSystem: MeasurementSystem;
  currency: Currency;
  language: string;
  region: string | undefined;
}

export interface BootSnapshotInput {
  /** Home's season headline (`rides.insights(tz)` + `headline`). */
  headline: { totals: { rides: number; distanceM: number } } | null;
  /** The full Rider insights payload, cached or fetched for Pro riders. */
  insights: SourcedRead<Pick<RiderInsightsData, 'totals' | 'territory'>>;
  /** Home's recent rides (`rides.list('home')`). */
  rides: MyRidesQuery | null;
  bikes: readonly Bike[];
  /** The primary bike's expenses, every year. */
  expenses: SourcedRead<ExpensesByMotorcycleQuery>;
  /** The primary bike's notes, newest first. */
  notes: SourcedRead<readonly Note[]>;
  /** This month's scan count, when cached. */
  scanQuotaUsed: number | null;
  prefs: SnapshotPrefs;
  now: Date;
  /** The category's on-screen name, for an expense with no description or item name. */
  categoryLabel: (category: string) => string;
}

export type BootInput = Pick<BootSnapshotInput, 'headline' | 'insights' | 'bikes' | 'prefs'>;

const PERCENT = { style: 'percent', maximumFractionDigits: 0 } as const;

/** Nickname, else make and model: the name the rider sees for their bike. */
function bikeName(bike: Bike): string {
  return bike.nickname?.trim() || `${bike.make} ${bike.model}`;
}

function seasonTotals(input: BootInput) {
  return input.headline?.totals ?? input.insights.data?.totals ?? null;
}

function hasData<T>(read: SourcedRead<T>): read is SourcedRead<T> & { data: T } {
  return read.data !== null;
}

/** An example page's source: the fetch missed, or the rider has none. */
function exampleSource(source: WhatsNewDataSource): WhatsNewDataSource {
  return source === WHATS_NEW_DATA_SOURCE.TIMED_OUT
    ? WHATS_NEW_DATA_SOURCE.TIMED_OUT
    : WHATS_NEW_DATA_SOURCE.NONE;
}

/** The boot's odometer: season distance, else the primary bike's odometer as stored, else nothing. */
export function buildBoot(input: BootInput): BootData {
  const locale = numberLocaleFor(input.prefs.language, input.prefs.region);
  const totals = seasonTotals(input);
  if (totals && totals.distanceM > 0) {
    const unit = mileageUnitLabel(input.prefs.measurementSystem);
    const { value, unit: unitLabel } = distanceParts(
      totals.distanceM,
      input.prefs.measurementSystem,
      locale,
    );
    return {
      kind: BOOT_KIND.SEASON,
      value: Math.round(metersToUnit(totals.distanceM, unit)),
      figure: value,
      unitLabel,
      rides: totals.rides,
    };
  }
  const bike = selectPrimaryBike(input.bikes);
  if (bike && hasOdometer(bike.currentMileage)) {
    return {
      kind: BOOT_KIND.ODO,
      value: Math.round(bike.currentMileage),
      figure: formatOdometer(bike.currentMileage, locale),
      unitLabel: toHubUnit(bike.distanceUnit),
      bikeName: bikeName(bike),
    };
  }
  return { kind: BOOT_KIND.NONE };
}

function decodedRoutes(rides: MyRidesQuery | null): RoutePath[] {
  return (rides?.myRides.edges ?? [])
    .map((edge) => edge.node.routePolyline)
    .filter((polyline): polyline is string => !!polyline)
    .map(decodePolylineLatLng)
    .filter((points) => points.length > 1);
}

function newRoadShare(insights: BootInput['insights'], locale: string): string | null {
  const territory = insights.data?.territory;
  const share = territory?.detail?.newRoadShare;
  if (territory?.status !== RiderInsightsStatus.Ready || share == null) return null;
  return new Intl.NumberFormat(locale, PERCENT).format(share);
}

function buildAtlas(input: BootSnapshotInput, locale: string): AtlasPageData {
  const feature = WHATS_NEW_FEATURE.ROAD_ATLAS;
  const routes = decodedRoutes(input.rides);
  const totals = seasonTotals(input);
  if (routes.length === 0) {
    const ridden = totals && totals.distanceM > 0 ? totals : null;
    const parts = ridden
      ? distanceParts(ridden.distanceM, input.prefs.measurementSystem, locale)
      : null;
    return {
      feature,
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      source: ridden ? WHATS_NEW_DATA_SOURCE.CACHE : WHATS_NEW_DATA_SOURCE.NONE,
      routes: EXAMPLE_ROUTES,
      unitLabel: mileageUnitLabel(input.prefs.measurementSystem),
      season:
        ridden && parts ? { distance: `${parts.value} ${parts.unit}`, rides: ridden.rides } : null,
    };
  }
  const usedInsights = input.headline === null || newRoadShare(input.insights, locale) !== null;
  const source =
    usedInsights && input.insights.source === WHATS_NEW_DATA_SOURCE.FETCHED
      ? WHATS_NEW_DATA_SOURCE.FETCHED
      : WHATS_NEW_DATA_SOURCE.CACHE;
  if (!totals || totals.distanceM <= 0) {
    return {
      feature,
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source,
      line: ATLAS_LINE.LAST_RIDES,
      distance: null,
      rides: routes.length,
      newRoadShare: null,
      routes,
    };
  }
  const { value, unit } = distanceParts(totals.distanceM, input.prefs.measurementSystem, locale);
  const share = newRoadShare(input.insights, locale);
  return {
    feature,
    kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
    source,
    line: share ? ATLAS_LINE.SEASON_WITH_SHARE : ATLAS_LINE.SEASON,
    distance: `${value} ${unit}`,
    rides: totals.rides,
    newRoadShare: share,
    routes,
  };
}

/** Latest by date, then by when it was logged. ISO strings compare in order. */
function latestExpense(data: ExpensesByMotorcycleQuery) {
  return flattenExpenses(data).reduce<ReturnType<typeof flattenExpenses>[number] | null>(
    (latest, item) =>
      !latest ||
      item.date > latest.date ||
      (item.date === latest.date && item.createdAt > latest.createdAt)
        ? item
        : latest,
    null,
  );
}

function buildScan(input: BootSnapshotInput, locale: string): ScanPageData {
  const feature = WHATS_NEW_FEATURE.RECEIPT_SCAN;
  const latest = hasData(input.expenses) ? latestExpense(input.expenses.data) : null;
  if (latest) {
    return {
      feature,
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: input.expenses.source,
      expenseId: latest.id,
      place:
        latest.description?.trim() ||
        latest.itemName?.trim() ||
        input.categoryLabel(latest.category),
      amount: formatMoney(latest.amount, latest.currency, input.prefs.currency),
      date: formatShortDate(latest.date, locale),
      category: latest.category,
    };
  }
  const fill = exampleFuelFill(input.prefs.currency);
  return {
    feature,
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: exampleSource(input.expenses.source),
    currency: fill.currency,
    amount: formatCurrency(fill.amount, fill.currency),
    date: formatShortDate(subDays(input.now, EXAMPLE_RECEIPT_DAYS_AGO), locale),
    category: EXAMPLE_RECEIPT_CATEGORY,
  };
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  );
}

function buildNotes(input: BootSnapshotInput, locale: string): NotesPageData {
  const feature = WHATS_NEW_FEATURE.NOTES_PHOTOS;
  const latest = input.notes.data?.find((note) => firstLine(note.text).length > 0);
  if (latest) {
    return {
      feature,
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: input.notes.source,
      noteId: latest.id,
      text: firstLine(latest.text),
      hasPhoto: latest.photos.length > 0,
    };
  }
  const pressure = EXAMPLE_TIRE_PRESSURE[input.prefs.measurementSystem];
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: pressure.fractionDigits,
    maximumFractionDigits: pressure.fractionDigits,
  });
  const bike = selectPrimaryBike(input.bikes);
  return {
    feature,
    kind: WHATS_NEW_DATA_KIND.EXAMPLE,
    source: exampleSource(input.notes.source),
    bikeName: bike ? bikeName(bike) : null,
    front: `${number.format(pressure.front)} ${pressure.unit}`,
    rear: `${number.format(pressure.rear)} ${pressure.unit}`,
  };
}

function priorUse(input: BootSnapshotInput): WhatsNewFeature[] {
  const used: WhatsNewFeature[] = [];
  if ((input.scanQuotaUsed ?? 0) > 0) used.push(WHATS_NEW_FEATURE.RECEIPT_SCAN);
  if (input.notes.data?.some((note) => note.photos.length > 0)) {
    used.push(WHATS_NEW_FEATURE.NOTES_PHOTOS);
  }
  return used;
}

/**
 * Everything What's New shows from the rider's data: the boot's odometer, one
 * value per page that is either the rider's own data or a labelled example, and
 * the features the rider already uses. Pure: the caller reads the cache and runs
 * the fetches.
 */
export function buildBootSnapshot(input: BootSnapshotInput): BootSnapshot {
  const locale = numberLocaleFor(input.prefs.language, input.prefs.region);
  return {
    boot: buildBoot(input),
    pages: {
      [WHATS_NEW_FEATURE.ROAD_ATLAS]: buildAtlas(input, locale),
      [WHATS_NEW_FEATURE.RECEIPT_SCAN]: buildScan(input, locale),
      [WHATS_NEW_FEATURE.NOTES_PHOTOS]: buildNotes(input, locale),
    },
    priorUse: priorUse(input),
  };
}
