'use client';

import {
  AllMaintenanceTasksDocument,
  ExpenseDashboardDocument,
  GetRiderProfileDocument,
  MeDocument,
  MyMotorcyclesDocument,
  MyRideCountDocument,
  RideOverviewDocument,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import {
  AppHandoffBand,
  AppHandoffBar,
  AppHandoffRail,
  type HandoffAccount,
  MonoLabel,
  pickPromotedHandoff,
  SerifAccent,
} from '@/components/garage-ui';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { AccountSection } from './account-row';
import { BikePreview, EmptyStartHero } from './empty-garage';
import {
  BikeHero,
  BikeHeroSkeleton,
  CardFailed,
  NextServiceCard,
  NextServiceSkeleton,
  RidesCard,
  RidesSkeleton,
  SpendCard,
  SpendSkeleton,
} from './garage-cards';
import {
  type Bike,
  distanceUnitFor,
  GarageMode,
  garageMode,
  isoDay,
  otherBikes,
  pickLeadBike,
  RidesCardState,
  ridesCardState,
  rideTotals,
  serviceSchedule,
  showsAppHandoff,
  yearOf,
  yearSpend,
} from './garage-model';
import { garageQueryKeys } from './query-keys';
import '@/components/garage-ui/garage-ui.css';
import './garage-view.css';

/**
 * Today as a local calendar day. Starts from the server's (UTC) day so the
 * hydrated HTML matches, then switches to the browser's own day after mount;
 * overdue and "this year" follow the rider's calendar, not the server's.
 */
function useToday(initialToday: string): string {
  const [today, setToday] = useState(initialToday);
  useEffect(() => {
    setToday(isoDay());
  }, []);
  return today;
}

function PageHead({ mode, bikeCount }: { mode: GarageMode; bikeCount: number }) {
  const t = useTranslations('GarageV2');
  const empty = mode === GarageMode.Empty;
  return (
    <header className="gv-head">
      <MonoLabel rule className="gv-eyebrow">
        {/* One inline run: the label is a flex row, so loose text would be spaced apart. */}
        <span>
          {t('eyebrowGarage')}
          {empty ? (
            <> · {t('eyebrowNoBikes')}</>
          ) : (
            <>
              {mode === GarageMode.Populated && (
                <span className="gv-hide-phone"> · {t('eyebrowBikes', { count: bikeCount })}</span>
              )}
              <span className="gv-show-desktop"> · {t('eyebrowReadOnlyWeb')}</span>
              <span className="gv-hide-desktop"> · {t('eyebrowReadOnly')}</span>
            </>
          )}
        </span>
      </MonoLabel>
      <h1 className="gv-title">
        {t('titleLead')} <SerifAccent>{t('titleSerif')}</SerifAccent>
      </h1>
      <p className={empty ? 'gv-intro gv-hide-phone' : 'gv-intro'}>
        {empty ? t('emptyIntro') : t('intro')}
      </p>
    </header>
  );
}

/**
 * Client view for /garage: the read-only garage (the web displays, the app
 * does, #277). Every action links to motovault.app/get. Data is prefetched in
 * page.tsx under the same query keys, so this paints with content on first
 * render; each card shows its own skeleton while its query is pending.
 */
export function GarageView({
  initialToday,
  account,
}: {
  initialToday: string;
  account: HandoffAccount;
}) {
  const t = useTranslations('GarageV2');
  const today = useToday(initialToday);
  const year = yearOf(today);

  useEffect(() => {
    trackEvent(WebEvent.GARAGE_VIEWED);
  }, []);

  // ─── Data ───
  const { data: meData } = useQuery({
    queryKey: garageQueryKeys.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const bikesQuery = useQuery({
    queryKey: garageQueryKeys.motorcycles,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bikes = bikesQuery.data?.myMotorcycles;
  const lead = pickLeadBike(bikes ?? []);
  const me = meData?.me;

  const expensesQuery = useQuery({
    queryKey: garageQueryKeys.expenses(lead?.id),
    queryFn: () => gqlFetcher(ExpenseDashboardDocument, { motorcycleId: lead?.id ?? '' }),
    enabled: !!lead,
  });
  const maintenanceQuery = useQuery({
    queryKey: garageQueryKeys.maintenance,
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  });
  const rideOverviewQuery = useQuery({
    queryKey: garageQueryKeys.rideOverview,
    queryFn: () => gqlFetcher(RideOverviewDocument),
  });
  const rideCountQuery = useQuery({
    queryKey: garageQueryKeys.rideCount,
    queryFn: () => gqlFetcher(MyRideCountDocument),
  });
  const profileQuery = useQuery({
    queryKey: garageQueryKeys.profile(me?.publicUsername),
    queryFn: () => gqlFetcher(GetRiderProfileDocument, { username: me?.publicUsername ?? '' }),
    enabled: !!me?.publicUsername,
  });

  // ─── Derived ───
  const mode = garageMode({
    bikes,
    isLoading: bikesQuery.isPending,
    isError: bikesQuery.isError,
  });
  const unit = distanceUnitFor(me?.measurementSystem);
  const schedule =
    lead && maintenanceQuery.data
      ? serviceSchedule(maintenanceQuery.data.allMaintenanceTasks, lead, today)
      : null;
  const spend = expensesQuery.data
    ? yearSpend(expensesQuery.data.expenseDashboard, year, me?.currency ?? 'USD')
    : null;
  const rides = rideTotals({
    profileStats: profileQuery.data?.getRiderProfile.rideStats,
    rideCount: rideCountQuery.data?.myRides.totalCount,
    lastRideDate: rideOverviewQuery.data?.rideOverview.lastRide?.date,
    lastRideKnown: rideOverviewQuery.isSuccess,
    unit,
  });
  const ridesState = ridesCardState({
    countSucceeded: rideCountQuery.isSuccess,
    countFailed: rideCountQuery.isError,
    profileSucceeded: profileQuery.isSuccess,
    profileFailed: profileQuery.isError,
    profileEnabled: !!me?.publicUsername,
    lastRidePending: rideOverviewQuery.isPending,
  });

  // At most one promoted "Better in the app" reason per page. Unknowns (still
  // loading, or failed) never promote.
  const overdueLead = schedule?.rows[0]?.overdue ? schedule.rows[0].task.title : null;
  const promoted = pickPromotedHandoff({
    overdueTaskTitle: overdueLead,
    hasRides: rides.hasRides,
    hasExpensesThisYear: spend ? spend.length > 0 : null,
    year,
  });

  // ─── Error ───
  if (mode === GarageMode.Error) {
    return (
      <div className="gv-page mvg-scope">
        <div className="gv-main">
          <PageHead mode={mode} bikeCount={0} />
          <div className="gv-error" role="alert">
            <p className="gv-error-title">{t('failedToLoad')}</p>
            <p className="gv-quiet">{t('failedToLoadBody')}</p>
            <button type="button" className="gv-retry" onClick={() => bikesQuery.refetch()}>
              {t('retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading ───
  if (mode === GarageMode.Loading) {
    return (
      <div className="gv-page mvg-scope">
        <div className="gv-main">
          <PageHead mode={mode} bikeCount={0} />
          <BikeHeroSkeleton />
          <div className="gv-pair">
            <NextServiceSkeleton />
            <SpendSkeleton />
          </div>
          <RidesSkeleton />
        </div>
      </div>
    );
  }

  const ridesCardByState: Record<RidesCardState, ReactNode> = {
    [RidesCardState.Ready]: <RidesCard totals={rides} unit={unit} />,
    [RidesCardState.Failed]: <CardFailed heading={t('ridesAllTime')} />,
    [RidesCardState.Loading]: <RidesSkeleton />,
  };
  const ridesCard = ridesCardByState[ridesState];

  // ─── Empty: no bike. The start hero is the handoff: no rail, band or bar. ───
  if (mode === GarageMode.Empty) {
    return (
      <div className="gv-page gv-page--empty mvg-scope">
        <div className="gv-main">
          <PageHead mode={mode} bikeCount={0} />
          <div className="gv-empty-grid">
            <EmptyStartHero account={account} promoted={promoted} />
            <BikePreview />
          </div>
          {/* Rides exist without a bike only when the bike was deleted: still the rider's data. A failed load shows its failed card: presence is then unknown. */}
          {(rides.hasRides || ridesState === RidesCardState.Failed) && ridesCard}
          <AccountSection account={account} />
        </div>
      </div>
    );
  }

  // ─── Populated ───
  const leadBike = lead as Bike;
  return (
    <>
      <div className="gv-page mvg-scope">
        <div className="gv-main">
          <PageHead mode={mode} bikeCount={bikes?.length ?? 0} />
          <BikeHero
            bike={leadBike}
            others={otherBikes(bikes ?? [], leadBike)}
            unit={unit}
            overdueCount={schedule?.overdueCount ?? null}
          />

          {/* ─── Free logging: service + spend (never gated, #271) ─── */}
          <div className="gv-pair">
            {schedule ? (
              <NextServiceCard schedule={schedule} unit={unit} />
            ) : maintenanceQuery.isError ? (
              <CardFailed heading={t('nextService')} />
            ) : (
              <NextServiceSkeleton />
            )}
            {spend ? (
              <SpendCard spend={spend} year={year} />
            ) : expensesQuery.isError ? (
              <CardFailed heading={t('spentIn', { year })} />
            ) : (
              <SpendSkeleton />
            )}
          </div>
          {/* ─── End free logging ─── */}

          {ridesCard}

          {showsAppHandoff(mode) && <AppHandoffBand account={account} promoted={promoted} />}
          <AccountSection account={account} />
        </div>
        {showsAppHandoff(mode) && <AppHandoffRail account={account} promoted={promoted} />}
      </div>
      {showsAppHandoff(mode) && <AppHandoffBar promoted={promoted} />}
    </>
  );
}
