// The What's New page data: the rider's own rides, expenses and notes when there
// are any, a labelled example in their units and currency when there are none,
// and the boot's odometer from the season distance or the bike's own odometer.

// The distance formatter lives beside the Rider insights hook, whose module loads the auth store.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());

import type {
  ExpensesByMotorcycleQuery,
  MyMotorcyclesQuery,
  MyRidesQuery,
  NotesByMotorcycleQuery,
} from '@motovault/graphql';
import { type Currency, MeasurementSystem } from '@motovault/types';
import { WHATS_NEW_DATA_KIND, WHATS_NEW_FEATURE } from '@/data/whats-new-releases';
import {
  BRATISLAVA_ROUTE,
  freeInsights,
  newRiderInsights,
  proInsights,
  RIOJA_ROUTE,
} from '@/test/rider-insights-fixtures';
import {
  ATLAS_LINE,
  BOOT_KIND,
  type BootSnapshotInput,
  buildBootSnapshot,
  WHATS_NEW_DATA_SOURCE,
} from '../build-boot-snapshot';
import { EXAMPLE_ROUTES, FALLBACK_FUEL_FILL } from '../whats-new-examples';

type Bike = MyMotorcyclesQuery['myMotorcycles'][number];
type Expense = ExpensesByMotorcycleQuery['expenses']['categories'][number]['expenses'][number];
type Note = NotesByMotorcycleQuery['notes'][number];

const NOW = new Date(2026, 10, 10, 12);

function bike(overrides: Partial<Bike> = {}): Bike {
  return {
    id: 'bike-1',
    userId: 'user-1',
    make: 'Honda',
    model: 'Africa Twin',
    year: 2022,
    nickname: null,
    variant: null,
    isPrimary: true,
    primaryPhotoUrl: null,
    currentMileage: 12_345,
    mileageUnit: null,
    distanceUnit: 'km',
    mileageUpdatedAt: null,
    purchasePrice: null,
    purchaseDate: null,
    type: null,
    engineCc: null,
    vin: null,
    recallCount: null,
    recallLastCheckedAt: null,
    odometerSyncSource: null,
    odometerLastRideId: null,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function ridesList(polylines: (string | null)[]): MyRidesQuery {
  return {
    myRides: {
      totalCount: polylines.length,
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: polylines.map((routePolyline, i) => ({
        cursor: `c${i}`,
        node: {
          id: `ride-${i}`,
          status: 'COMPLETED' as MyRidesQuery['myRides']['edges'][number]['node']['status'],
          name: null,
          startedAt: '2026-10-01T08:00:00Z',
          endedAt: null,
          distanceM: 50_000,
          maxSpeedMps: null,
          avgSpeedMps: null,
          elevationGain: null,
          pausedDurationS: 0,
          autoPausedDurationS: 0,
          durationS: null,
          motorcycleId: 'bike-1',
          routePolyline,
          routeThumbnailUri: null,
          gpsQuality: null,
        },
      })),
    },
  };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    amount: 22.85,
    category: 'fuel',
    currency: 'EUR',
    description: 'Repsol',
    itemName: null,
    maintenanceTaskId: null,
    date: '2026-10-28',
    createdAt: '2026-10-28T10:00:00Z',
    ...overrides,
  };
}

function expensesOf(items: Expense[]): ExpensesByMotorcycleQuery {
  return {
    expenses: {
      ytdTotal: 0,
      currencyTotals: [],
      categories: [{ category: 'fuel', total: 0, currencyTotals: [], expenses: items }],
    },
  };
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    motorcycleId: 'bike-1',
    text: 'Chain slack 30 mm\nadjusted at the rear axle',
    odometer: null,
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    linkedTaskId: null,
    linkedTaskTitle: null,
    linkedExpenseId: null,
    linkedExpenseAmount: null,
    linkedExpenseCurrency: null,
    photos: [],
    ...overrides,
  };
}

const NONE = { data: null, source: WHATS_NEW_DATA_SOURCE.NONE };

function input(overrides: Partial<BootSnapshotInput> = {}): BootSnapshotInput {
  return {
    headline: null,
    insights: NONE,
    rides: null,
    bikes: [bike()],
    expenses: NONE,
    notes: NONE,
    scanQuotaUsed: null,
    prefs: {
      measurementSystem: MeasurementSystem.METRIC,
      currency: 'USD',
      language: 'en',
      region: 'US',
    },
    now: NOW,
    categoryLabel: (category) => `label:${category}`,
    ...overrides,
  };
}

const imperial = (currency: Currency = 'USD') => ({
  measurementSystem: MeasurementSystem.IMPERIAL,
  currency,
  language: 'en',
  region: 'US',
});

const metric = (currency: Currency = 'EUR') => ({
  measurementSystem: MeasurementSystem.METRIC,
  currency,
  language: 'en',
  region: 'US',
});

const headline = { totals: { rides: 36, distanceM: 2_507_000 } };

describe('Road Atlas page', () => {
  it("draws the rider's own routes and quotes the season in km", () => {
    const { pages } = buildBootSnapshot(
      input({ headline, rides: ridesList([RIOJA_ROUTE, BRATISLAVA_ROUTE]), prefs: metric() }),
    );
    const atlas = pages[WHATS_NEW_FEATURE.ROAD_ATLAS];
    expect(atlas).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: WHATS_NEW_DATA_SOURCE.CACHE,
      line: ATLAS_LINE.SEASON,
      distance: '2,507 km',
      rides: 36,
      newRoadShare: null,
    });
    if (atlas.kind !== WHATS_NEW_DATA_KIND.YOUR_DATA) throw new Error('expected your data');
    expect(atlas.routes).toHaveLength(2);
    expect(atlas.routes[1][0]).toEqual([expect.any(Number), expect.any(Number)]);
  });

  it('quotes the season in miles for an imperial rider', () => {
    const { pages } = buildBootSnapshot(
      input({ headline, rides: ridesList([RIOJA_ROUTE]), prefs: imperial() }),
    );
    expect(pages[WHATS_NEW_FEATURE.ROAD_ATLAS]).toMatchObject({ distance: '1,558 mi' });
  });

  it('adds the share of new roads when Territory is unlocked', () => {
    const { pages } = buildBootSnapshot(
      input({
        headline,
        rides: ridesList([RIOJA_ROUTE]),
        insights: { data: proInsights(), source: WHATS_NEW_DATA_SOURCE.FETCHED },
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.ROAD_ATLAS]).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: WHATS_NEW_DATA_SOURCE.FETCHED,
      line: ATLAS_LINE.SEASON_WITH_SHARE,
      newRoadShare: '84%',
    });
  });

  it('leaves the share out when Territory is locked', () => {
    const { pages } = buildBootSnapshot(
      input({
        headline,
        rides: ridesList([RIOJA_ROUTE]),
        insights: { data: freeInsights(), source: WHATS_NEW_DATA_SOURCE.CACHE },
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.ROAD_ATLAS]).toMatchObject({
      line: ATLAS_LINE.SEASON,
      newRoadShare: null,
    });
  });

  it('uses the full insights totals when the Home headline is not cached', () => {
    const { pages } = buildBootSnapshot(
      input({
        rides: ridesList([RIOJA_ROUTE]),
        insights: { data: newRiderInsights(), source: WHATS_NEW_DATA_SOURCE.CACHE },
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.ROAD_ATLAS]).toMatchObject({ distance: '210 km', rides: 4 });
  });

  it('says "your last rides" when routes exist but the season has no distance yet', () => {
    const { pages } = buildBootSnapshot(
      input({
        headline: { totals: { rides: 0, distanceM: 0 } },
        rides: ridesList([RIOJA_ROUTE, null, BRATISLAVA_ROUTE]),
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.ROAD_ATLAS]).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      line: ATLAS_LINE.LAST_RIDES,
      distance: null,
      rides: 2,
    });
  });

  it('draws the example routes when the rider has no routes', () => {
    const { pages } = buildBootSnapshot(input({ headline, rides: ridesList([null]) }));
    expect(pages[WHATS_NEW_FEATURE.ROAD_ATLAS]).toEqual({
      feature: WHATS_NEW_FEATURE.ROAD_ATLAS,
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      source: WHATS_NEW_DATA_SOURCE.NONE,
      routes: EXAMPLE_ROUTES,
      unitLabel: 'km',
    });
  });
});

describe('boot odometer', () => {
  it('rolls to the season distance in the rider unit', () => {
    const { boot } = buildBootSnapshot(input({ headline, prefs: imperial() }));
    expect(boot).toEqual({
      kind: BOOT_KIND.SEASON,
      value: 1558,
      figure: '1,558',
      unitLabel: 'mi',
      rides: 36,
    });
  });

  it("falls back to the bike's odometer in its own unit, never converted", () => {
    const { boot } = buildBootSnapshot(
      input({
        bikes: [bike({ currentMileage: 12_345, distanceUnit: 'mi', nickname: 'Bluebird' })],
        prefs: metric(),
      }),
    );
    expect(boot).toEqual({
      kind: BOOT_KIND.ODO,
      value: 12_345,
      figure: '12,345',
      unitLabel: 'mi',
      bikeName: 'Bluebird',
    });
  });

  it('uses the odometer when the season distance is 0', () => {
    const { boot } = buildBootSnapshot(input({ headline: { totals: { rides: 0, distanceM: 0 } } }));
    expect(boot).toMatchObject({ kind: BOOT_KIND.ODO, bikeName: 'Honda Africa Twin' });
  });

  it('reads the primary bike, not the first one', () => {
    const { boot } = buildBootSnapshot(
      input({
        bikes: [
          bike({ id: 'b0', isPrimary: false, currentMileage: 1 }),
          bike({ id: 'b1', isPrimary: true, currentMileage: 900 }),
        ],
      }),
    );
    expect(boot).toMatchObject({ kind: BOOT_KIND.ODO, value: 900 });
  });

  it('hides the odometer with no rides and no bike', () => {
    expect(buildBootSnapshot(input({ bikes: [] })).boot).toEqual({ kind: BOOT_KIND.NONE });
  });

  it('hides the odometer when the bike has no reading', () => {
    const { boot } = buildBootSnapshot(input({ bikes: [bike({ currentMileage: null })] }));
    expect(boot).toEqual({ kind: BOOT_KIND.NONE });
  });
});

describe('Scan a receipt page', () => {
  it("shows the latest expense in its own currency, not the rider's", () => {
    const { pages } = buildBootSnapshot(
      input({
        prefs: imperial('USD'),
        expenses: {
          data: expensesOf([expense({ id: 'old', date: '2026-09-01', amount: 9 }), expense()]),
          source: WHATS_NEW_DATA_SOURCE.FETCHED,
        },
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.RECEIPT_SCAN]).toEqual({
      feature: WHATS_NEW_FEATURE.RECEIPT_SCAN,
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: WHATS_NEW_DATA_SOURCE.FETCHED,
      expenseId: 'exp-1',
      place: 'Repsol',
      amount: '€22.85',
      date: 'Oct 28',
      category: 'fuel',
    });
  });

  it('shows an expense from last year, since it reads every year', () => {
    const { pages } = buildBootSnapshot(
      input({
        expenses: {
          data: expensesOf([expense({ date: '2025-03-14' })]),
          source: WHATS_NEW_DATA_SOURCE.CACHE,
        },
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.RECEIPT_SCAN]).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: WHATS_NEW_DATA_SOURCE.CACHE,
      date: 'Mar 14',
    });
  });

  it('takes the place from the item name, then the category, when the description is empty', () => {
    const fromItem = buildBootSnapshot(
      input({
        expenses: {
          data: expensesOf([expense({ description: '  ', itemName: 'Michelin Road 6' })]),
          source: WHATS_NEW_DATA_SOURCE.FETCHED,
        },
      }),
    );
    expect(fromItem.pages[WHATS_NEW_FEATURE.RECEIPT_SCAN]).toMatchObject({
      place: 'Michelin Road 6',
    });

    const fromCategory = buildBootSnapshot(
      input({
        expenses: {
          data: expensesOf([expense({ description: null, itemName: null, category: 'tires' })]),
          source: WHATS_NEW_DATA_SOURCE.FETCHED,
        },
      }),
    );
    expect(fromCategory.pages[WHATS_NEW_FEATURE.RECEIPT_SCAN]).toMatchObject({
      place: 'label:tires',
    });
  });

  it("shows an example fuel receipt in the rider's currency when there are no expenses", () => {
    const { pages } = buildBootSnapshot(
      input({
        prefs: metric('GBP'),
        expenses: { data: expensesOf([]), source: WHATS_NEW_DATA_SOURCE.FETCHED },
      }),
    );
    const scan = pages[WHATS_NEW_FEATURE.RECEIPT_SCAN];
    expect(scan).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      source: WHATS_NEW_DATA_SOURCE.NONE,
      currency: 'GBP',
      category: 'fuel',
      date: 'Nov 7',
    });
    if (scan.kind !== WHATS_NEW_DATA_KIND.EXAMPLE) throw new Error('expected example');
    expect(scan.amount).toMatch(/^£\d+\.\d{2}$/);
  });

  it('falls back to the documented amount for a currency outside the table', () => {
    const { pages } = buildBootSnapshot(
      input({ prefs: { ...metric(), currency: 'XYZ' as Currency } }),
    );
    expect(pages[WHATS_NEW_FEATURE.RECEIPT_SCAN]).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      currency: FALLBACK_FUEL_FILL.currency,
      amount: `$${FALLBACK_FUEL_FILL.amount.toFixed(2)}`,
    });
  });

  it('marks the example timed out when the expense fetch did not land', () => {
    const { pages } = buildBootSnapshot(
      input({ expenses: { data: null, source: WHATS_NEW_DATA_SOURCE.TIMED_OUT } }),
    );
    expect(pages[WHATS_NEW_FEATURE.RECEIPT_SCAN]).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      source: WHATS_NEW_DATA_SOURCE.TIMED_OUT,
    });
  });
});

describe('Notes page', () => {
  it("shows the latest note's first line", () => {
    const { pages } = buildBootSnapshot(
      input({
        notes: {
          data: [note(), note({ id: 'older', text: 'Older', createdAt: '2026-01-01T00:00:00Z' })],
          source: WHATS_NEW_DATA_SOURCE.FETCHED,
        },
      }),
    );
    expect(pages[WHATS_NEW_FEATURE.NOTES_PHOTOS]).toEqual({
      feature: WHATS_NEW_FEATURE.NOTES_PHOTOS,
      kind: WHATS_NEW_DATA_KIND.YOUR_DATA,
      source: WHATS_NEW_DATA_SOURCE.FETCHED,
      noteId: 'note-1',
      text: 'Chain slack 30 mm',
      hasPhoto: false,
    });
  });

  it('shows an example tire note in psi for an imperial rider, with the bike name', () => {
    const { pages } = buildBootSnapshot(
      input({ prefs: imperial(), notes: { data: [], source: WHATS_NEW_DATA_SOURCE.FETCHED } }),
    );
    expect(pages[WHATS_NEW_FEATURE.NOTES_PHOTOS]).toEqual({
      feature: WHATS_NEW_FEATURE.NOTES_PHOTOS,
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      source: WHATS_NEW_DATA_SOURCE.NONE,
      bikeName: 'Honda Africa Twin',
      front: '36 psi',
      rear: '42 psi',
    });
  });

  it('shows the example tire note in bar for a metric rider, without a bike', () => {
    const { pages } = buildBootSnapshot(input({ prefs: metric(), bikes: [] }));
    expect(pages[WHATS_NEW_FEATURE.NOTES_PHOTOS]).toMatchObject({
      kind: WHATS_NEW_DATA_KIND.EXAMPLE,
      bikeName: null,
      front: '2.5 bar',
      rear: '2.9 bar',
    });
  });
});

describe('prior use', () => {
  it('reports notes with photos and a used scan quota', () => {
    const { priorUse } = buildBootSnapshot(
      input({
        scanQuotaUsed: 2,
        notes: {
          data: [
            note(),
            note({ id: 'n2', photos: [{ id: 'p', storagePath: 's', publicUrl: 'u' }] }),
          ],
          source: WHATS_NEW_DATA_SOURCE.FETCHED,
        },
      }),
    );
    expect(priorUse).toEqual([WHATS_NEW_FEATURE.RECEIPT_SCAN, WHATS_NEW_FEATURE.NOTES_PHOTOS]);
  });

  it('reports nothing for an unused quota and notes without photos', () => {
    const { priorUse } = buildBootSnapshot(
      input({ scanQuotaUsed: 0, notes: { data: [note()], source: WHATS_NEW_DATA_SOURCE.CACHE } }),
    );
    expect(priorUse).toEqual([]);
  });
});
