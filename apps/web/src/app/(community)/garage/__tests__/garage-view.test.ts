import fs from 'node:fs';
import path from 'node:path';
import type {
  AllMaintenanceTasksQuery,
  ExpenseDashboardQuery,
  MeQuery,
  MyMotorcyclesQuery,
  MyRideCountQuery,
  RideOverviewQuery,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { type ComponentProps, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SignInMethod } from '@/components/garage-ui/handoff';
import { GarageView } from '../garage-view';
import { garageQueryKeys } from '../query-keys';

/**
 * Renders /garage's client view on the server (as SSR does) from a seeded
 * query cache, i.e. a mocked API response, with no production account. Checks
 * which layout and which handoff placements each data state produces.
 */

const messages = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'messages/en.json'), 'utf8'),
) as Record<string, unknown>;

const PERIOD = { rideCount: 0, distanceM: 0, durationS: 0 };

function me(): MeQuery {
  return {
    me: {
      id: 'u1',
      email: 'rider@example.com',
      role: 'user' as MeQuery['me']['role'],
      measurementSystem: 'metric',
      currency: 'EUR',
      publicUsername: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

function rides(lastRide: RideOverviewQuery['rideOverview']['lastRide']): RideOverviewQuery {
  return {
    rideOverview: {
      lastRide,
      last7Days: PERIOD,
      last30Days: PERIOD,
      thisWeek: PERIOD,
      thisMonth: PERIOD,
      dailyDistances: [],
      personalRecords: [],
    },
  };
}

function render(seed: (client: QueryClient) => void): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed(client);
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        NextIntlClientProvider,
        // children go in createElement's third argument; the props type requires them.
        { locale: 'en', messages, timeZone: 'UTC' } as ComponentProps<
          typeof NextIntlClientProvider
        >,
        createElement(GarageView, {
          initialToday: '2026-10-06',
          account: { method: SignInMethod.Email, email: 'rider@example.com' },
        }),
      ),
    ),
  );
}

const RAIL = 'mvg-rail';
const BAND = 'mvg-band';

describe('GarageView: empty account (no bike, no data)', () => {
  const html = render((client) => {
    client.setQueryData<MeQuery>(garageQueryKeys.me, me());
    client.setQueryData<MyMotorcyclesQuery>(garageQueryKeys.motorcycles, { myMotorcycles: [] });
    client.setQueryData<AllMaintenanceTasksQuery>(garageQueryKeys.maintenance, {
      allMaintenanceTasks: [],
    });
    client.setQueryData<RideOverviewQuery>(garageQueryKeys.rideOverview, rides(null));
    client.setQueryData<MyRideCountQuery>(garageQueryKeys.rideCount, {
      myRides: { totalCount: 0 },
    });
  });

  it('renders the start-in-the-app hero and the bike preview', () => {
    expect(html).toContain('Add your bike in the app. It takes 30 seconds.');
    expect(html).toContain('This is where your bike lives');
    expect(html).toContain('Garage · No bikes yet');
  });

  it('renders no rail and no band (the hero is the handoff)', () => {
    expect(html).not.toContain(RAIL);
    expect(html).not.toContain(BAND);
  });

  it('promotes "No rides yet" (known zero rides)', () => {
    expect(html).toContain('No rides yet');
  });

  it('renders no bike, service or spend card, and no placeholder data', () => {
    expect(html).not.toContain('Next service');
    expect(html).not.toContain('Spent in');
    expect(html).not.toMatch(/\[(GRADE|Bike photo|N|Category|odometer)\]/);
  });

  it('keeps the Account section', () => {
    expect(html).toContain('Account');
  });
});

describe('GarageView: populated', () => {
  const dashboard: ExpenseDashboardQuery = {
    expenseDashboard: {
      currency: 'EUR',
      currentYearTotal: 0,
      previousYearTotal: 0,
      allTimeTotal: 0,
      expenseCount: 2,
      monthlyBuckets: [],
      categoryTotals: [],
      currencies: [
        {
          currency: 'EUR',
          currentYearTotal: 1960.62,
          previousYearTotal: 0,
          allTimeTotal: 1960.62,
          expenseCount: 1,
          monthlyBuckets: [
            {
              month: 3,
              year: 2026,
              total: 492,
              categories: [{ category: 'insurance', total: 492 }],
            },
          ],
          categoryTotals: [],
        },
        {
          currency: 'USD',
          currentYearTotal: 45,
          previousYearTotal: 0,
          allTimeTotal: 45,
          expenseCount: 1,
          monthlyBuckets: [
            { month: 7, year: 2026, total: 45, categories: [{ category: 'tolls', total: 45 }] },
          ],
          categoryTotals: [],
        },
      ],
    },
  };

  const html = render((client) => {
    client.setQueryData<MeQuery>(garageQueryKeys.me, me());
    client.setQueryData<MyMotorcyclesQuery>(garageQueryKeys.motorcycles, {
      myMotorcycles: [
        {
          id: 'b1',
          userId: 'u1',
          make: 'Honda',
          model: 'Africa Twin',
          year: 2022,
          variant: 'DCT',
          isPrimary: true,
          primaryPhotoUrl: null,
          currentMileage: 38_423,
          mileageUnit: 'mi',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    client.setQueryData<AllMaintenanceTasksQuery>(garageQueryKeys.maintenance, {
      allMaintenanceTasks: [
        {
          id: 't1',
          motorcycleId: 'b1',
          title: 'Brake Pads Inspection',
          dueDate: '2026-03-15',
          targetMileage: 42_100,
          priority: 'high' as AllMaintenanceTasksQuery['allMaintenanceTasks'][number]['priority'],
          status: 'pending' as AllMaintenanceTasksQuery['allMaintenanceTasks'][number]['status'],
          remind30d: false,
          remind7d: false,
          remind1d: false,
        },
      ],
    });
    client.setQueryData<ExpenseDashboardQuery>(garageQueryKeys.expenses('b1'), dashboard);
    client.setQueryData<RideOverviewQuery>(
      garageQueryKeys.rideOverview,
      rides({ id: 'r1', distanceM: 1000, durationS: 60, date: '2026-10-03' }),
    );
    client.setQueryData<MyRideCountQuery>(garageQueryKeys.rideCount, {
      myRides: { totalCount: 19 },
    });
  });

  it('renders the rail and the band beside the cards', () => {
    expect(html).toContain(RAIL);
    expect(html).toContain(BAND);
  });

  it('labels the raw odometer with the rider setting, not the per-bike unit', () => {
    expect(html).toMatch(/38,423<span class="gv-odo-unit">km<\/span>/);
  });

  it('marks the past-due task overdue by date and promotes it', () => {
    expect(html).toContain('Overdue by date');
    expect(html).toContain('Brake Pads Inspection is overdue');
  });

  it('shows one total per currency, never a sum', () => {
    expect(html).toContain('€1,960.62');
    expect(html).toContain('$45.00');
    expect(html).not.toContain('2,005');
  });

  it('labels ride totals as all time, never as this year', () => {
    expect(html).toContain('Rides · All time');
    expect(html).not.toMatch(/Rides 20\d\d|this year/);
    expect(html).toContain('3 Oct 2026');
  });

  it('hides what the API does not have (grade, year expense count)', () => {
    expect(html).not.toMatch(/\[GRADE\]|expenses<\/span>|Health ·/);
  });
});

describe('GarageView: ride count failed and no rider profile', () => {
  const html = render((client) => {
    // A settled error: without this, mount would retry and show the query as pending.
    client.setDefaultOptions({ queries: { retry: false, retryOnMount: false } });
    client.setQueryData<MeQuery>(garageQueryKeys.me, me());
    client.setQueryData<MyMotorcyclesQuery>(garageQueryKeys.motorcycles, {
      myMotorcycles: [
        {
          id: 'b1',
          userId: 'u1',
          make: 'Honda',
          model: 'Africa Twin',
          year: 2022,
          variant: 'DCT',
          isPrimary: true,
          primaryPhotoUrl: null,
          currentMileage: 38_423,
          mileageUnit: 'mi',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    client.setQueryData<RideOverviewQuery>(garageQueryKeys.rideOverview, rides(null));
    // MyRideCount errored; publicUsername is null, so the profile query never runs.
    client
      .getQueryCache()
      .build(client, { queryKey: garageQueryKeys.rideCount })
      .setState({ status: 'error', error: new Error('boom'), fetchStatus: 'idle' });
  });

  it('shows the rides card failed state instead of a skeleton forever', () => {
    expect(html).toContain('Rides · All time');
    expect(html).toContain('This didn&#x27;t load. Refresh the page to try again.');
    expect(html).not.toContain('gv-rides-skel');
  });
});
