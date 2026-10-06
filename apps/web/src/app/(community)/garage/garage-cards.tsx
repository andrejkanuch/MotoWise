'use client';

import { ArrowUpRight, Camera, CircleCheck, Route, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { APP_HANDOFF_URL, GarageCard, MonoLabel, Skeleton } from '@/components/garage-ui';
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
      <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
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
    <a href={APP_HANDOFF_URL} className="mvg-link gv-action">
      {icon}
      <span>{children}</span>
      {arrow && <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />}
    </a>
  );
}

/** A card body that could not load (the rest of the page still renders). */
export function CardFailed({ heading }: { heading: string }) {
  const t = useTranslations('GarageV2');
  return (
    <GarageCard className="gv-card">
      <MonoLabel as="h2">{heading}</MonoLabel>
      <p className="gv-quiet">{t('cardFailed')}</p>
    </GarageCard>
  );
}

// ── Bike hero ────────────────────────────────────────────────────────

function BikePhoto({ bike, sizes }: { bike: Bike; sizes: string }) {
  const t = useTranslations('GarageV2');
  if (!bike.primaryPhotoUrl) {
    // No photo: a plain striped tile, with no label (DATA-MAP §3).
    return <div className="gv-hero-photo gv-stripes" aria-hidden="true" />;
  }
  return (
    <div className="gv-hero-photo">
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

function Odometer({ value, unit }: { value: number; unit: string }) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  return (
    <div className="gv-hero-odo">
      <MonoLabel>{t('odometer')}</MonoLabel>
      <div className="gv-odo-value">
        {formatInteger(value, fmt)}
        <span className="gv-odo-unit">{unit}</span>
      </div>
    </div>
  );
}

function OtherBikes({ bikes, unit }: { bikes: Bike[]; unit: string }) {
  const t = useTranslations('GarageV2');
  const fmt = useGarageFormat();
  return (
    <div className="gv-hero-others">
      <MonoLabel>{t('alsoInGarage', { count: bikes.length })}</MonoLabel>
      <ul className="gv-thumbs">
        {bikes.map((bike) => (
          <li key={bike.id} className="gv-thumb">
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
 * The lead bike: photo, make · year, model in serif, odometer (raw, labelled
 * with the rider's unit) and the overdue count. The health grade letter is not
 * in the API, so it is not shown (DATA-MAP §3); the chip shows the overdue
 * count alone and disappears at zero.
 */
export function BikeHero({
  bike,
  others,
  unit,
  overdueCount,
}: {
  bike: Bike;
  others: Bike[];
  unit: string;
  /** null while maintenance is loading: no chip rather than a wrong one. */
  overdueCount: number | null;
}) {
  const t = useTranslations('GarageV2');
  return (
    <GarageCard padding="none" className="gv-hero" aria-label={t('bikeRegion')}>
      <BikePhoto bike={bike} sizes="(min-width: 1280px) 440px, (min-width: 768px) 260px, 100vw" />
      <div className="gv-hero-body">
        <div className="gv-hero-title">
          <MonoLabel>
            <span>
              {bike.make} · {bike.year}
              {bike.variant && <span className="gv-hide-xl"> · {bike.variant}</span>}
            </span>
          </MonoLabel>
          <h2 className="gv-model">{bike.model}</h2>
          {bike.variant && <div className="gv-variant gv-show-xl">{bike.variant}</div>}
        </div>
        {overdueCount != null && overdueCount > 0 && (
          <span className="gv-chip">
            <OverdueMark>{t('overdueCount', { count: overdueCount })}</OverdueMark>
          </span>
        )}
        {bike.currentMileage != null && <Odometer value={bike.currentMileage} unit={unit} />}
        {others.length > 0 && <OtherBikes bikes={others} unit={unit} />}
      </div>
    </GarageCard>
  );
}

export function BikeHeroSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="mvg-card mvg-card--pad-none gv-hero"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton height="100%" radius={0} className="gv-hero-photo" />
      <div className="gv-hero-body gv-skel-stack">
        <Skeleton width={120} height={10} radius={5} />
        <Skeleton width={220} height={34} />
        <span className="gv-skel-rule" />
        <Skeleton width={160} height={28} />
        <Skeleton width={130} height={32} radius={9999} />
      </div>
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
  return <span className="gv-row-meta">{[day, distance].filter(Boolean).join(' · ')}</span>;
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
      <GarageCard className="gv-card gv-svc" aria-labelledby="gv-svc-h">
        <MonoLabel as="h2" id="gv-svc-h">
          {t('nextService')}
        </MonoLabel>
        <p className="gv-empty-line">
          {t('noService')} <span>{t('noServiceBody')}</span>
        </p>
        <AppLink icon={<CircleCheck size={16} strokeWidth={2} aria-hidden="true" />}>
          {t('openMotoVault')}
        </AppLink>
      </GarageCard>
    );
  }

  const restHasOverdue = rest.some((row) => row.overdue);
  return (
    <GarageCard className="gv-card gv-svc" aria-labelledby="gv-svc-h">
      <div className="gv-card-head">
        <MonoLabel as="h2" id="gv-svc-h">
          {t('nextService')}
        </MonoLabel>
        <span className="gv-count">{t('scheduledCount', { count: schedule.scheduledCount })}</span>
      </div>
      <div className={lead.overdue ? 'gv-lead gv-lead--overdue' : 'gv-lead'}>
        {lead.overdue ? (
          <OverdueMark>{t(OVERDUE_LABEL[lead.overdue])}</OverdueMark>
        ) : (
          <MonoLabel>{t('nextUp')}</MonoLabel>
        )}
        <h3 className="gv-lead-title">{lead.task.title}</h3>
        <ServiceMeta row={lead} unit={unit} withDuePrefix />
      </div>
      {rest.length > 0 && (
        <div className="gv-rows">
          <MonoLabel className="gv-rows-label">
            {restHasOverdue ? t('alsoDue') : t('comingUp')}
          </MonoLabel>
          <ul>
            {rest.map((row) => (
              <li key={row.task.id} className="gv-row">
                <span className="gv-row-title">
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
    </GarageCard>
  );
}

export function NextServiceSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="mvg-card mvg-card--pad-lg gv-card gv-skel-stack"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton width={110} height={10} radius={5} />
      <Skeleton height={104} radius={12} />
      <Skeleton height={40} />
      <Skeleton height={40} />
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

function CategorySplit({ spend }: { spend: CurrencySpend }) {
  const fmt = useGarageFormat();
  const largest = spend.categories[0]?.total ?? 0;
  return (
    <ul className="gv-cats">
      {spend.categories.map(({ category, total }, index) => (
        <li key={category} className="gv-cat">
          <span className="gv-cat-name">
            <CategoryLabel category={category} />
          </span>
          <span className="gv-cat-track" aria-hidden="true">
            <span
              className={index === 0 ? 'gv-cat-fill gv-cat-fill--top' : 'gv-cat-fill'}
              style={{ width: `${largest > 0 ? Math.max(1, (total / largest) * 100) : 0}%` }}
            />
          </span>
          <span className="gv-cat-amt">{formatMoneyWhole(total, spend.currency, fmt)}</span>
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
    <GarageCard className="gv-card gv-spend" aria-labelledby="gv-spend-h">
      <MonoLabel as="h2" id="gv-spend-h">
        {t('spentIn', { year })}
      </MonoLabel>
      {spend.length === 0 ? (
        <p className="gv-empty-line">{t('nothingLogged', { year })}</p>
      ) : (
        <>
          <p className="gv-spend-total">
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
                {multi && <MonoLabel className="gv-split-code">{entry.currency}</MonoLabel>}
                <CategorySplit spend={entry} />
              </div>
            ))}
          </div>
        </>
      )}
      <AppLink icon={<Camera size={16} strokeWidth={2} aria-hidden="true" />}>
        {t('snapReceipt')}
      </AppLink>
    </GarageCard>
  );
}

export function SpendSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="mvg-card mvg-card--pad-lg gv-card gv-skel-stack"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton width={110} height={10} radius={5} />
      <Skeleton width={200} height={36} />
      <Skeleton height={10} radius={5} />
      <Skeleton width="80%" height={10} radius={5} />
      <Skeleton width="60%" height={10} radius={5} />
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
 * All-time ride totals. The design's "Rides 2026" numbers have no API source
 * (no year-scoped ride stats), so the card shows the real all-time count (and
 * distance when the rider profile provides it), labelled "All time".
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
      <GarageCard
        padding="md"
        className="gv-card gv-rides gv-rides--empty"
        aria-labelledby="gv-rides-h"
      >
        <MonoLabel as="h2" id="gv-rides-h">
          {t('ridesAllTime')}
        </MonoLabel>
        <p className="gv-empty-line">{t('noRides')}</p>
        {link}
      </GarageCard>
    );
  }

  const lastRide = lastRideDay ? formatDay(lastRideDay, fmt) : null;
  const stats = 1 + (totals.distance != null ? 1 : 0) + (lastRide ? 1 : 0);
  return (
    <GarageCard
      padding="md"
      className="gv-card gv-rides"
      aria-labelledby="gv-rides-h"
      style={{ ['--gv-ride-stats' as string]: stats }}
    >
      <MonoLabel as="h2" id="gv-rides-h">
        {t('ridesAllTime')}
      </MonoLabel>
      <dl className="gv-ride-stats">
        <div className="gv-ride-stat">
          <dt>{t('ridesUnit', { count: totals.count ?? 0 })}</dt>
          <dd className="gv-ride-num">{formatInteger(totals.count ?? 0, fmt)}</dd>
        </div>
        {totals.distance != null && (
          <div className="gv-ride-stat">
            <dt>{t('distance')}</dt>
            <dd className="gv-ride-num">
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
            <dd className="gv-ride-date">{lastRide}</dd>
          </div>
        )}
      </dl>
      {link}
    </GarageCard>
  );
}

export function RidesSkeleton() {
  const t = useTranslations('GarageV2');
  return (
    <div
      className="mvg-card mvg-card--pad-md gv-card gv-rides-skel"
      role="status"
      aria-busy="true"
      aria-label={t('loading')}
    >
      <Skeleton height={52} />
      <Skeleton height={52} />
      <Skeleton height={52} />
    </div>
  );
}
