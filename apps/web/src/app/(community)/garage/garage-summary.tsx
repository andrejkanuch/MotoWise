'use client';

import {
  AllMaintenanceTasksDocument,
  GetRideTotalsThisYearDocument,
  GetServiceSpendThisYearDocument,
  MyMotorcyclesDocument,
} from '@motovault/graphql';
import { computeHealthScore, type HealthGrade } from '@motovault/types';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Bike, CircleDollarSign, Crown, Route, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DoInAppHint } from '@/components/do-in-app-hint';
import { useProStatus } from '@/hooks/use-pro-status';
import { formatMoneyTotalsShort } from '@/lib/expense-money';
import { pickNextService, sumTotalsPerCurrency, webVisibleBikes } from '@/lib/garage-summary';
import { gqlFetcher } from '@/lib/graphql-client';
import { garageQueryKeys } from './query-keys';
import './garage.css';

const GRADE_TONE: Record<HealthGrade, string> = {
  A: 'good',
  B: 'good',
  C: 'warn',
  D: 'bad',
  F: 'bad',
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Read-only summary of the rider's garage, shown on /garage and /profile:
 * bikes with their health grade, the next service due, this year's service
 * spend per currency, this year's ride totals, and the Pro status. Each action
 * links to the app through a DoInAppHint that says why only the app can do it.
 *
 * Query keys come from garageQueryKeys, so /garage paints from its server
 * prefetch and both pages share one cache.
 */
export function GarageSummary() {
  const t = useTranslations('Garage');
  const tHandoff = useTranslations('AppHandoff');
  const pro = useProStatus();

  const { data: bikesData } = useQuery({
    queryKey: garageQueryKeys.motorcycles,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const { data: maintenanceData } = useQuery({
    queryKey: garageQueryKeys.maintenance,
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  });
  const { data: rideData } = useQuery({
    queryKey: garageQueryKeys.rideTotals,
    queryFn: () => gqlFetcher(GetRideTotalsThisYearDocument),
  });

  const bikes = bikesData?.myMotorcycles ?? [];
  const tasks = maintenanceData?.allMaintenanceTasks ?? [];
  const visibleBikes = webVisibleBikes(bikes, pro.isPro);
  const hiddenBikeCount = bikes.length - visibleBikes.length;

  const spendQueries = useQueries({
    queries: visibleBikes.map((bike) => ({
      queryKey: garageQueryKeys.serviceSpend(bike.id),
      queryFn: () => gqlFetcher(GetServiceSpendThisYearDocument, { motorcycleId: bike.id }),
    })),
  });
  const spendLoaded = spendQueries.every((query) => query.data);
  const spend = sumTotalsPerCurrency(
    spendQueries.map((query) => query.data?.spendingSummary.thisYearByCurrency ?? []),
  );

  const nextService = pickNextService(tasks);
  const nextServiceDays = nextService?.dueDate ? daysUntil(nextService.dueDate) : null;
  const nextServiceBike = bikes.find((bike) => bike.id === nextService?.motorcycleId);
  const overdueCount = tasks.filter((task) => task.dueDate && daysUntil(task.dueDate) < 0).length;

  const thisYear = rideData?.rideOverview.thisYear;
  const rideKm = thisYear ? Math.round(thisYear.distanceM / 1000) : 0;
  const rideHours = thisYear ? Math.round(thisYear.durationS / 3600) : 0;

  const bikeName = (bike: (typeof bikes)[number]) =>
    bike.nickname || `${bike.year} ${bike.make} ${bike.model}`;

  return (
    <section className="garage-summary">
      <div className="sect-header" style={{ marginTop: 0 }}>
        <div className="sect-header-left">
          <h3>
            {t('summaryTitle')} <span className="serif">{t('summaryTitleSerif')}</span>
          </h3>
          <span className="sect-header-meta">{new Date().getFullYear()}</span>
        </div>
        {!pro.isLoading && (
          <span className={`summary-plan${pro.isPro ? ' pro' : ''}`}>
            {pro.isPro && <Crown aria-hidden="true" />}
            {pro.isPro
              ? pro.isTrialing
                ? pro.trialDaysLeft != null
                  ? t('planProTrialDays', { days: pro.trialDaysLeft })
                  : t('planProTrial')
                : t('planPro')
              : t('planFree')}
          </span>
        )}
      </div>

      <div className="stats-bar" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <Bike className="h-4 w-4" />
            </div>
          </div>
          <div className="stat-num ink">{bikesData ? bikes.length : '--'}</div>
          <div className="stat-lbl">{t('bikes')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <Wrench className="h-4 w-4" />
            </div>
            {overdueCount > 0 && (
              <div className="stat-trend warn">{t('overdueCount', { count: overdueCount })}</div>
            )}
          </div>
          {nextService?.dueDate && nextServiceDays != null ? (
            <>
              <div className="stat-num ink summary-text">{nextService.title}</div>
              <div className="summary-sub">
                {nextServiceBike && `${bikeName(nextServiceBike)} · `}
                {`${formatShortDate(nextService.dueDate)} · `}
                {nextServiceDays < 0
                  ? t('dLate', { days: Math.abs(nextServiceDays) })
                  : t('dRemaining', { days: nextServiceDays })}
              </div>
            </>
          ) : (
            <div className="stat-num ink summary-text">
              {maintenanceData ? t('summaryNothingDue') : '--'}
            </div>
          )}
          <div className="stat-lbl">{t('summaryNextService')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <CircleDollarSign className="h-4 w-4" />
            </div>
            {hiddenBikeCount > 0 && (
              <div className="stat-trend flat">
                {t('summaryBikeScope', { visible: visibleBikes.length, total: bikes.length })}
              </div>
            )}
          </div>
          {/* Per currency ("€320 · $45"), never a sum across currencies. */}
          <div className="stat-num">
            {!bikesData || !spendLoaded
              ? '--'
              : spend.length > 0
                ? formatMoneyTotalsShort(spend)
                : t('summaryNoSpend')}
          </div>
          <div className="stat-lbl">{t('summaryServiceSpend')}</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <div className="stat-icon">
              <Route className="h-4 w-4" />
            </div>
            {thisYear && thisYear.rideCount > 0 && (
              <div className="stat-trend flat">
                {t('summaryRideDistance', {
                  km: rideKm.toLocaleString('en-US'),
                  hours: rideHours,
                })}
              </div>
            )}
          </div>
          <div className="stat-num ink">{thisYear ? thisYear.rideCount : '--'}</div>
          <div className="stat-lbl">{t('summaryRides')}</div>
        </div>
      </div>

      {visibleBikes.length > 0 && (
        <ul className="summary-bikes">
          {visibleBikes.map((bike) => {
            const health = computeHealthScore(
              tasks.filter((task) => task.motorcycleId === bike.id),
            );
            return (
              <li key={bike.id} className="summary-bike">
                <span className="summary-bike-name">{bikeName(bike)}</span>
                {health.hasData ? (
                  <span
                    className={`summary-grade ${GRADE_TONE[health.grade]}`}
                    title={t('summaryHealthScore', { score: health.score })}
                  >
                    <span className="summary-grade-lbl">{t('summaryHealth')}</span>
                    {health.grade}
                  </span>
                ) : (
                  <span className="summary-grade none">{t('summaryNoHealthData')}</span>
                )}
              </li>
            );
          })}
          {hiddenBikeCount > 0 && (
            <li className="summary-bike muted">
              {t('summaryHiddenBikes', { count: hiddenBikeCount })}
            </li>
          )}
        </ul>
      )}

      <div className="summary-hints">
        <DoInAppHint reason={tHandoff('reasonBikes')} />
        <DoInAppHint reason={tHandoff('reasonService')} />
        <DoInAppHint reason={tHandoff('reasonRides')} />
      </div>
    </section>
  );
}
