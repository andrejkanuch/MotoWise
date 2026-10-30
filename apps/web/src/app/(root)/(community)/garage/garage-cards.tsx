'use client';

import { palette } from '@motovault/design-system';
import { type ExpenseCategory, MileageUnit } from '@motovault/types';
import { ArrowUpRight, Camera, CircleCheck, Route, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { APP_HANDOFF_URL, MonoLabel, Skeleton } from '@/components/garage-ui';
import { BikePlate } from '@/components/marketing/bike-plate';
import { expenseCategoryMessageKey } from '@/lib/expense-category-label';
import {
  type Bike,
  type CurrencySpend,
  formatDay,
  formatInteger,
  formatMoney,
  formatMoneyWhole,
  type GarageFormat,
  localDayOf,
  OverdueKind,
  type RideTotals,
  type ServiceRow,
  type ServiceSchedule,
} from './garage-model';

// ── Shared bits ──────────────────────────────────────────────────────

function useGarageFormat(): GarageFormat {
  return { format: useFormatter(), locale: useLocale() };
}

/** The overdue marker: icon + text, never colour alone. */
function OverdueMark({ children }: { children: ReactNode }) {
  return (
    <span className="gv-overdue">
      <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
      {children}
    </span>
  );
}

/** A copper action link to motovault.app/get (the web never edits). */
function AppLink({
  icon,
  children,
  arrow = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  arrow?: boolean;
}) {
  return (
    <a href={APP_HANDOFF_URL} className="mv-link is-quiet is-tall gv-action">
      {icon}
      <span>{children}</span>
      {arrow && <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />}
    </a>
  );
}

/** A section title in the system face (one condensed title per page: the H1). */
function SectionHead({
  id,
  children,
  aside,
}: {
  id: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="gv-section-head">
      <h2 id={id} className="gv-h2">
        {children}
      </h2>
      {aside}
    </div>
  );
}

/**
 * A section whose body could not load (the rest of the page still renders):
 * names what happened and offers the way out, a retry of that section's
 * own queries.
 */
export function CardFailed({ heading, onRetry }: { heading: string; onRetry: () => void }) {
  const t = useTranslations('GarageV2');
  return (
    <section className="gv-section" role="alert">
      <h2 className="gv-h2">{heading}</h2>
      <p className="gv-empty-line">
        {t('cardFailed')} <span>{t('cardFailedBody')}</span>
      </p>
      <button type="button" className="mv-btn mv-btn-ghost is-compact gv-action" onClick={onRetry}>
        {t('retry')}
      </button>
    </section>
  );
}

// ── Bike plate ───────────────────────────────────────────────────────

/** Plate state, as the app's Bike Plate: bone = ready, signal = due soon, red = overdue. */
export const PlateState = { Ready: 'ready', Due: 'due', Overdue: 'overdue' } as const;
export type PlateState = (typeof PlateState)[keyof typeof PlateState];

/** The app's "due soon" windows (apps/mobile/src/lib/bike-hub/constants.ts). */
const DUE_SOON_DAYS = 30;
const DUE_SOON_DISTANCE: Record<MileageUnit, number> = {
  [MileageUnit.KM]: 2000,
  [MileageUnit.MI]: 1200,
};
const DAY_MS = 86_400_000;
const NO_FIGURE = '—';

/** Whole days from `from` to `to`, both `YYYY-MM-DD` calendar days (UTC, so SSR and client agree). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / DAY_MS);
}

export type PlateCopy = {
  state: PlateState;
  figure: string;
  unit: string;
  caption: string;
  /** The figure is the odometer itself (nothing due), so the identity rows need not repeat it. */
  figureIsOdometer: boolean;
};

type PlateInput = {
  lead: ServiceRow | undefined;
  odometer: number | null | undefined;
  unit: MileageUnit;
  today: string;
  fmt: GarageFormat;
  t: ReturnType<typeof useTranslations<'GarageV2'>>;
};

/**
 * What the plate says, as the app's Home plate does (home-plate.ts): the
 * countdown to the bike's most urgent task (the schedule's lead row), or,
 * with nothing due, a ready plate showing the odometer. Distances are raw in
 * the rider's unit; days are calendar days from `today`.
 */
export function describePlate({ lead, odometer, unit, today, fmt, t }: PlateInput): PlateCopy {
  const hasOdometer = odometer != null;
  const task = lead?.task;
  const hasLimit = !!task && (!!task.dueDate || task.targetMileage != null);

  if (!task || !hasLimit) {
    return {
      state: PlateState.Ready,
      figure: hasOdometer ? formatInteger(odometer, fmt) : NO_FIGURE,
      unit: hasOdometer ? unit : '',
      caption: t('plateNoServiceDue'),
      figureIsOdometer: hasOdometer,
    };
  }

  const late = t('plateCaptionLate', { task: task.title });
  if (lead.overdue === OverdueKind.Date && task.dueDate) {
    const days = Math.max(0, daysBetween(task.dueDate, today));
    return {
      state: PlateState.Overdue,
      figure: formatInteger(days, fmt),
      unit: t('plateDays', { count: days }),
      caption: late,
      figureIsOdometer: false,
    };
  }
  if (lead.overdue === OverdueKind.Distance && task.targetMileage != null && hasOdometer) {
    return {
      state: PlateState.Overdue,
      figure: formatInteger(Math.max(0, odometer - task.targetMileage), fmt),
      unit,
      caption: late,
      figureIsOdometer: false,
    };
  }

  // Not overdue: count down along the nearer limit (nearer relative to its window).
  const daysLeft = task.dueDate ? Math.max(0, daysBetween(today, task.dueDate)) : null;
  const distanceLeft =
    task.targetMileage != null && hasOdometer ? Math.max(0, task.targetMileage - odometer) : null;
  const dayRatio = daysLeft == null ? Number.POSITIVE_INFINITY : daysLeft / DUE_SOON_DAYS;
  const distanceRatio =
    distanceLeft == null ? Number.POSITIVE_INFINITY : distanceLeft / DUE_SOON_DISTANCE[unit];
  const to = t('plateCaptionTo', { task: task.title });

  if (daysLeft == null && distanceLeft == null) {
    // A target odometer with no odometer reading: the target itself.
    return {
      state: PlateState.Ready,
      figure: NO_FIGURE,
      unit: '',
      caption: t('plateCaptionAt', {
        task: task.title,
        target: `${formatInteger(task.targetMileage ?? 0, fmt)} ${unit}`,
      }),
      figureIsOdometer: false,
    };
  }
  if (distanceRatio <= dayRatio && distanceLeft != null) {
    return {
      state: distanceRatio <= 1 ? PlateState.Due : PlateState.Ready,
      figure: formatInteger(distanceLeft, fmt),
      unit,
      caption: to,
      figureIsOdometer: false,
    };
  }
  const days = daysLeft ?? 0;
  return {
    state: dayRatio <= 1 ? PlateState.Due : PlateState.Ready,
    figure: formatInteger(days, fmt),
    unit: t('plateDays', { count: days }),
    caption: to,
    figureIsOdometer: false,
  };
}

const STATE_LABEL_KEY = {
  [PlateState.Ready]: 'plateStateReady',
  [PlateState.Due]: 'plateStateDue',
  [PlateState.Overdue]: 'plateStateOverdue',
} as const;

/** The plate edge holds one line; past this the variant gives way to "make model · year". */
const PLATE_IDENTITY_MAX = 40;

/**
 * The identity printed on the plate edge: "make model · variant · year", or
 * "make model · year" when the full string would not fit the edge (the plate
 * truncates with an ellipsis as the backstop; `title` keeps the full text).
 */
export function plateIdentity(bike: Pick<Bike, 'make' | 'model' | 'variant' | 'year'>): string {
  const name = `${bike.make} ${bike.model}`;
  const year = String(bike.year);
  const full = [name, bike.variant, year].filter(Boolean).join(' · ');
  return full.length > PLATE_IDENTITY_MAX ? `${name} · ${year}` : full;
}

function BikePhoto({ bike, sizes }: { bike: Bike; sizes: string }) {
  const t = useTranslations('GarageV2');
  if (!bike.primaryPhotoUrl) {
    // No photo: a plain striped tile, with no label (DATA-MAP §3).
    return <div className="gv-photo gv-stripes" aria-hidden="true" />;
  }
  return (
    <div className="gv-photo">
      <Image
        src={bike.primaryPhotoUrl}
        alt={t('bikePhotoAlt', { year: bike.year, make: bike.make, model: bike.model })}
        fill
        sizes={sizes}
        // Above the fold at every width and the page's LCP element: load it
        // eagerly at high priority instead of lazily (Next flagged it as LCP).
        loading="eager"
        fetchPriority="high"
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
}

function OtherBikes({ bikes, unit }: { bikes: Bike[]; unit: string }) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  return (
    <div className="gv-section" style={{ gap: 4 }}>
      <MonoLabel>{t('alsoInGarage', { count: bikes.length })}</MonoLabel>
      <ul className="mv-rows is-open">
        {bikes.map((bike) => (
          <li key={bike.id} className="mv-row gv-thumb">
            {bike.primaryPhotoUrl ? (
              <span className="gv-thumb-photo">
                <Image
                  src={bike.primaryPhotoUrl}
                  alt=""
                  fill
                  sizes="40px"
                  style={{ objectFit: 'cover' }}
                />
              </span>
            ) : (
              <span className="gv-thumb-photo gv-stripes gv-stripes--fine" aria-hidden="true" />
            )}
            <span className="gv-thumb-text">
              <span className="gv-thumb-name">
                {bike.make} {bike.model}
              </span>
              <span className="gv-thumb-meta">
                {bike.year}
                {bike.currentMileage != null &&
                  ` · ${formatInteger(bike.currentMileage, fmt)} ${unit}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The lead bike as the app draws it: a Bike Plate whose fill is the bike's
 * readiness (the schedule's lead task), the condensed countdown figure, the
 * identity edge with its racing number, then hairline rows (odometer, raw and
 * labelled with the rider's unit; the overdue count; the rest of the garage)
 * and the photo. The health grade letter is not in the API, so it is not
 * shown (DATA-MAP §3).
 */
export function BikeHero({
  bike,
  others,
  unit,
  schedule,
  today,
  racingNumber,
}: {
  bike: Bike;
  others: Bike[];
  unit: MileageUnit;
  /** null while maintenance is loading: a ready plate rather than a wrong one. */
  schedule: ServiceSchedule | null;
  today: string;
  /** The bike's index in the garage, printed on the plate edge ("01"). */
  racingNumber: string;
}) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  const plate = describePlate({
    lead: schedule?.rows[0],
    odometer: bike.currentMileage,
    unit,
    today,
    fmt,
    t,
  });
  const stateWord = t(STATE_LABEL_KEY[plate.state]);
  const overdueCount = schedule?.overdueCount ?? 0;
  const identity = plateIdentity(bike);

  return (
    <section className="gv-bike" aria-label={t('bikeRegion')}>
      <div className="gv-bike-main">
        <div className="gv-plate-slot">
          <span className="mvg-sr-only">{t('plateRegion', { state: stateWord })}</span>
          <BikePlate
            figure={plate.figure}
            unit={plate.unit}
            caption={plate.caption}
            racingNumber={racingNumber}
            identity={identity}
            state={plate.state}
            stateLabel={stateWord}
            settle
          />
        </div>
        {(bike.currentMileage != null && !plate.figureIsOdometer) || overdueCount > 0 ? (
          <ul className="mv-rows is-open gv-ident">
            {bike.currentMileage != null && !plate.figureIsOdometer && (
              <li className="mv-row gv-row">
                <span className="gv-ident-label">{t('odometer')}</span>
                <span className="gv-odo-value mv-figure">
                  {formatInteger(bike.currentMileage, fmt)}
                  <span className="gv-odo-unit">{unit}</span>
                </span>
              </li>
            )}
            {overdueCount > 0 && (
              <li className="mv-row gv-row">
                <span className="gv-ident-label">{t('nextService')}</span>
                <OverdueMark>{t('overdueCount', { count: overdueCount })}</OverdueMark>
              </li>
            )}
          </ul>
        ) : null}
        {others.length > 0 && <OtherBikes bikes={others} unit={unit} />}
      </div>
      <BikePhoto bike={bike} sizes="(min-width: 1280px) 440px, (min-width: 768px) 300px, 100vw" />
    </section>
  );
}

export function BikeHeroSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div className="gv-bike" role="status" aria-busy="true" aria-label={t('loading')}>
      <div className="gv-bike-main gv-skel-stack">
        <Skeleton height={168} radius={20} className="gv-plate-slot" />
        <Skeleton height={44} radius={8} />
        <Skeleton width="60%" height={44} radius={8} />
      </div>
      <Skeleton height="100%" radius={16} className="gv-photo" />
    </div>
  );
}

// ── Next service ─────────────────────────────────────────────────────

function ServiceMeta({
  row,
  unit,
  withDuePrefix,
}: {
  row: ServiceRow;
  unit: string;
  withDuePrefix: boolean;
}) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  const { dueDate, targetMileage } = row.task;
  const day = dueDate ? formatDay(dueDate, fmt) : null;
  const distance = targetMileage != null ? `${formatInteger(targetMileage, fmt)} ${unit}` : null;
  if (withDuePrefix) {
    return (
      <div className="gv-lead-meta">
        {day && <span>{t('dueOn', { date: day })}</span>}
        {day && distance && <span>{t('or')}</span>}
        {distance && <span>{distance}</span>}
      </div>
    );
  }
  return (
    <span className="mv-row-aside gv-row-meta">{[day, distance].filter(Boolean).join(' · ')}</span>
  );
}

const OVERDUE_LABEL = {
  [OverdueKind.Date]: 'overdueByDate',
  [OverdueKind.Distance]: 'overdueByDistance',
} as const;

export function NextServiceCard({ schedule, unit }: { schedule: ServiceSchedule; unit: string }) {
  const t = useTranslations('GarageV2');
  const [lead, ...rest] = schedule.rows;

  if (!lead) {
    return (
      <section className="gv-section gv-svc" aria-labelledby="gv-svc-h">
        <SectionHead id="gv-svc-h">{t('nextService')}</SectionHead>
        <p className="gv-empty-line">
          {t('noService')} <span>{t('noServiceBody')}</span>
        </p>
        <AppLink icon={<CircleCheck size={16} strokeWidth={2} aria-hidden="true" />}>
          {t('openMotoVault')}
        </AppLink>
      </section>
    );
  }

  const restHasOverdue = rest.some((row) => row.overdue);
  return (
    <section className="gv-section gv-svc" aria-labelledby="gv-svc-h">
      <SectionHead
        id="gv-svc-h"
        aside={
          <span className="gv-count">
            {t('scheduledCount', { count: schedule.scheduledCount })}
          </span>
        }
      >
        {t('nextService')}
      </SectionHead>
      <div className="gv-lead">
        {lead.overdue ? (
          <OverdueMark>{t(OVERDUE_LABEL[lead.overdue])}</OverdueMark>
        ) : (
          <MonoLabel>{t('nextUp')}</MonoLabel>
        )}
        <h3 className="mv-h3">{lead.task.title}</h3>
        <ServiceMeta row={lead} unit={unit} withDuePrefix />
      </div>
      {rest.length > 0 && (
        <div>
          <MonoLabel className="gv-rows-label">
            {restHasOverdue ? t('alsoDue') : t('comingUp')}
          </MonoLabel>
          <ul className="mv-rows is-open">
            {rest.map((row) => (
              <li key={row.task.id} className="mv-row gv-row">
                <span className="mv-row-title gv-row-title">
                  {row.task.title}
                  {row.overdue && <OverdueMark>{t('overdueTag')}</OverdueMark>}
                </span>
                <ServiceMeta row={row} unit={unit} withDuePrefix={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <AppLink icon={<CircleCheck size={16} strokeWidth={2} aria-hidden="true" />} arrow>
        {t('markDone')}
      </AppLink>
    </section>
  );
}

export function NextServiceSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="gv-section gv-skel-stack"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton width={120} height={20} radius={6} />
      <Skeleton width="70%" height={36} radius={8} />
      <Skeleton height={44} />
      <Skeleton height={44} />
    </div>
  );
}

// ── This-year spend ──────────────────────────────────────────────────

function CategoryLabel({ category }: { category: string }) {
  // Category labels are the existing translated Garage.cat* messages.
  const t = useTranslations('Garage');
  const key = expenseCategoryMessageKey(category);
  return <>{t.has(key) ? t(key as Parameters<typeof t>[0]) : category}</>;
}

/**
 * One hue per category, the app's own (bike-hub tokens): the dark set on the
 * graphite ramp, the plate-light set on paper, each ≥3:1 on its ground. Never
 * copper (a verb) or a status colour. The hue only ever sits beside the
 * category's name; an unknown category falls back to "other".
 */
const CATEGORY_HUE: Record<ExpenseCategory, { dark: string; light: string }> = {
  fuel: { dark: palette.hubCatFuel, light: palette.plateLightCatFuel },
  maintenance: { dark: palette.hubCatService, light: palette.plateLightCatService },
  parts: { dark: palette.hubCatParts, light: palette.plateLightCatParts },
  tires: { dark: palette.hubCatTires, light: palette.plateLightCatTires },
  gear: { dark: palette.hubCatGear, light: palette.plateLightCatGear },
  accessories: { dark: palette.hubCatAccessories, light: palette.plateLightCatAccessories },
  modifications: { dark: palette.hubCatMods, light: palette.plateLightCatMods },
  insurance: { dark: palette.hubCatInsurance, light: palette.plateLightCatInsurance },
  registration: { dark: palette.hubCatRegistration, light: palette.plateLightCatRegistration },
  taxes_fees: { dark: palette.hubCatTaxes, light: palette.plateLightCatTaxes },
  tolls: { dark: palette.hubCatTolls, light: palette.plateLightCatTolls },
  parking: { dark: palette.hubCatParking, light: palette.plateLightCatParking },
  training: { dark: palette.hubCatTraining, light: palette.plateLightCatTraining },
  other: { dark: palette.hubCatOther, light: palette.plateLightCatOther },
};

function isExpenseCategory(category: string): category is ExpenseCategory {
  return category in CATEGORY_HUE;
}

/** The bar's hue for both schemes, as custom properties garage-view.css reads per scheme. */
function categoryHueStyle(category: string, width: number): CSSProperties {
  const hue = CATEGORY_HUE[isExpenseCategory(category) ? category : 'other'];
  return {
    width: `${width}%`,
    '--gv-cat-dark': hue.dark,
    '--gv-cat-light': hue.light,
  } as CSSProperties;
}

function CategorySplit({ spend }: { spend: CurrencySpend }) {
  const fmt = useGarageFormat();
  const largest = spend.categories[0]?.total ?? 0;
  return (
    <ul className="mv-rows is-open">
      {spend.categories.map(({ category, total }) => (
        <li key={category} className="mv-row gv-cat">
          <span className="gv-cat-name">
            <CategoryLabel category={category} />
          </span>
          <span className="gv-cat-track" aria-hidden="true">
            <span
              className="gv-cat-fill"
              style={categoryHueStyle(
                category,
                largest > 0 ? Math.max(1, (total / largest) * 100) : 0,
              )}
            />
          </span>
          <span className="gv-cat-amt mv-figure">
            {formatMoneyWhole(total, spend.currency, fmt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Spend for the lead bike this calendar year: one total per currency, side by
 * side, never summed (#275), each with its own category split. The year's
 * expense count is not in the API (only all-time), so it is not shown.
 */
export function SpendCard({ spend, year }: { spend: CurrencySpend[]; year: number }) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  const multi = spend.length > 1;

  return (
    <section className="gv-section gv-spend" aria-labelledby="gv-spend-h">
      <SectionHead id="gv-spend-h">{t('spentIn', { year })}</SectionHead>
      {spend.length === 0 ? (
        <p className="gv-empty-line">{t('nothingLogged', { year })}</p>
      ) : (
        <>
          <p className="gv-spend-total mv-figure">
            {spend.map(({ currency, total }, index) => (
              <span key={currency} className="gv-spend-part">
                {index > 0 && (
                  <span className="gv-spend-sep" aria-hidden="true">
                    ·
                  </span>
                )}
                <span>{formatMoney(total, currency, fmt)}</span>
              </span>
            ))}
          </p>
          <div className="gv-split">
            {spend.map((entry) => (
              <div key={entry.currency} className="gv-split-group">
                {multi && <MonoLabel>{entry.currency}</MonoLabel>}
                <CategorySplit spend={entry} />
              </div>
            ))}
          </div>
        </>
      )}
      <AppLink icon={<Camera size={16} strokeWidth={2} aria-hidden="true" />}>
        {t('snapReceipt')}
      </AppLink>
    </section>
  );
}

export function SpendSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="gv-section gv-skel-stack"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton width={120} height={20} radius={6} />
      <Skeleton width={200} height={48} radius={8} />
      <Skeleton height={40} />
      <Skeleton width="80%" height={40} />
    </div>
  );
}

// ── Rides ────────────────────────────────────────────────────────────

/**
 * A day value as the rider's local day. The first render keeps the value as
 * given (formatDay reads it in UTC, as SSR did, so hydration matches); after
 * mount a timestamp switches to the browser's own calendar day.
 */
function useLocalDay(value: string | null): string | null {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return value && mounted ? localDayOf(value) : value;
}

/**
 * All-time ride totals. There is no year-scoped ride stat in the API, so the
 * strip shows the real all-time count (and distance when the rider profile
 * provides it), labelled "All time".
 */
export function RidesCard({ totals, unit }: { totals: RideTotals; unit: string }) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  const lastRideDay = useLocalDay(totals.lastRideDate);
  const link = (
    <AppLink icon={<Route size={16} strokeWidth={2} aria-hidden="true" />}>
      {t('recordRide')}
    </AppLink>
  );

  if (totals.hasRides === false) {
    return (
      <section className="gv-section gv-rides gv-rides--empty" aria-labelledby="gv-rides-h">
        <SectionHead id="gv-rides-h">{t('ridesAllTime')}</SectionHead>
        <p className="gv-empty-line">{t('noRides')}</p>
        {link}
      </section>
    );
  }

  const lastRide = lastRideDay ? formatDay(lastRideDay, fmt) : null;
  const stats = 1 + (totals.distance != null ? 1 : 0) + (lastRide ? 1 : 0);
  return (
    <section
      className="gv-section gv-rides"
      aria-labelledby="gv-rides-h"
      style={{ ['--gv-ride-stats' as string]: stats }}
    >
      <SectionHead id="gv-rides-h">{t('ridesAllTime')}</SectionHead>
      <div className="gv-rides-body">
        <dl className="gv-ride-stats">
          <div className="gv-ride-stat">
            <dt>{t('ridesUnit', { count: totals.count ?? 0 })}</dt>
            <dd className="gv-ride-num mv-figure">{formatInteger(totals.count ?? 0, fmt)}</dd>
          </div>
          {totals.distance != null && (
            <div className="gv-ride-stat">
              <dt>{t('distance')}</dt>
              <dd className="gv-ride-num mv-figure">
                {formatInteger(totals.distance, fmt)}
                <span className="gv-ride-unit">{unit}</span>
              </dd>
            </div>
          )}
          {lastRide && (
            <div className="gv-ride-stat gv-ride-stat--last">
              <dt>
                <span className="gv-hide-phone">{t('lastRide')}</span>
                <span className="gv-show-phone">{t('lastRideRow')}</span>
              </dt>
              <dd className="gv-ride-date mv-figure">{lastRide}</dd>
            </div>
          )}
        </dl>
        {link}
      </div>
    </section>
  );
}

export function RidesSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="gv-section gv-rides-skel"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton height={56} />
      <Skeleton height={56} />
      <Skeleton height={56} />
    </div>
  );
}
