/**
 * Fixtures of features/bike-detail-shell-overview/EXECUTION_PLAN.md › Fixtures.
 * "Today" is 2026-10-02; bike A is the 2022 Africa Twin at 38,167 km.
 */
import {
  MaintenancePriority,
  MaintenanceTaskSource,
  MaintenanceTaskStatus,
} from '@motovault/graphql';
import type { AttentionRecallInput, AttentionTaskInput } from '../lib/bike-hub/attention';
import { HUB_UNIT } from '../lib/bike-hub/constants';
import type { HubCategoryInput, HubDocumentInput } from '../lib/bike-hub/documents';
import type { DueContext } from '../lib/bike-hub/task-due';

/** Local midnight, so calendar-day differences do not depend on the test machine's zone. */
export const TODAY = new Date(2026, 9, 2);
export const ODOMETER = 38_167;

export const KM: DueContext = { odometer: ODOMETER, today: TODAY, unit: HUB_UNIT.KM };

export function task(
  overrides: Partial<AttentionTaskInput> & Pick<AttentionTaskInput, 'id' | 'title'>,
): AttentionTaskInput {
  return {
    priority: MaintenancePriority.Medium,
    status: MaintenanceTaskStatus.Pending,
    dueDate: null,
    targetMileage: null,
    source: MaintenanceTaskSource.User,
    ...overrides,
  };
}

export const BRAKE_PADS = task({
  id: 'brake-pads',
  title: 'Brake pads inspection',
  priority: MaintenancePriority.High,
  dueDate: '2026-03-15',
  targetMileage: 42_100,
});
export const COOLANT = task({
  id: 'coolant',
  title: 'Coolant',
  priority: MaintenancePriority.Medium,
  dueDate: '2026-08-01',
});
export const TIRE_PRESSURE = task({
  id: 'tire-pressure',
  title: 'Tire pressure',
  priority: MaintenancePriority.Low,
  dueDate: '2026-07-01',
});
export const CHAIN = task({
  id: 'chain',
  title: 'Chain clean & lube',
  priority: MaintenancePriority.Low,
  dueDate: '2026-09-01',
});
export const AIR_FILTER = task({
  id: 'air-filter',
  title: 'Air filter',
  priority: MaintenancePriority.Medium,
  dueDate: '2026-10-04',
  targetMileage: 46_900,
});

export const BIKE_A_TASKS: AttentionTaskInput[] = [
  AIR_FILTER,
  CHAIN,
  BRAKE_PADS,
  TIRE_PRESSURE,
  COOLANT,
];

export const CATEGORIES: HubCategoryInput[] = [
  { id: 'cat-insurance', name: 'Insurance', kind: 'seeded' },
  { id: 'cat-registration', name: 'Registration', kind: 'seeded' },
  { id: 'cat-inspection', name: 'Inspection', kind: 'seeded' },
  { id: 'cat-warranty', name: 'Warranty', kind: 'seeded' },
  { id: 'cat-manual', name: 'Manual', kind: 'seeded' },
  { id: 'cat-custom-insurance', name: 'Insurance', kind: 'custom' },
];

export function document(
  overrides: Partial<HubDocumentInput> & Pick<HubDocumentInput, 'id'>,
): HubDocumentInput {
  return { title: 'Document', categoryId: 'cat-manual', expiryDate: null, ...overrides };
}

export const INSURANCE = document({
  id: 'doc-insurance',
  title: 'Mapfre',
  categoryId: 'cat-insurance',
  expiryDate: '2026-10-14',
});

export const BIKE_A_DOCUMENTS: HubDocumentInput[] = [
  INSURANCE,
  document({ id: 'doc-manual', title: 'Owner manual' }),
  document({ id: 'doc-title', title: 'Title' }),
  document({ id: 'doc-service', title: 'Service book' }),
];

export const ECU_RECALL: AttentionRecallInput = {
  campaignNumber: '24V-123',
  component: 'ELECTRICAL SYSTEM: ECU',
  summary: 'The fuel-injection ECU may cause the engine to stall while riding.',
  consequence: 'An engine stall increases the risk of a crash.',
};

/** Bike A as `myMotorcycles` returns it. */
export const BIKE_A = {
  id: 'bike-a',
  userId: 'user-1',
  make: 'Honda',
  model: 'Africa Twin',
  year: 2022,
  nickname: null,
  variant: 'DCT',
  isPrimary: true,
  primaryPhotoUrl: 'https://example.test/hero.webp',
  currentMileage: ODOMETER,
  distanceUnit: 'km',
  purchasePrice: 11_800,
  purchaseDate: '2022-06-15',
  recallCount: 1,
  createdAt: '2022-06-15T00:00:00Z',
};

/** Bike B: nothing tracked. */
export const BIKE_B = {
  id: 'bike-b',
  userId: 'user-1',
  make: 'Yamaha',
  model: 'Ténéré 700',
  year: 2024,
  nickname: null,
  variant: null,
  isPrimary: false,
  primaryPhotoUrl: null,
  currentMileage: 1_240,
  distanceUnit: 'km',
  purchasePrice: 10_400,
  purchaseDate: null,
  recallCount: 0,
  createdAt: '2024-03-01T00:00:00Z',
};

let expenseId = 0;
/** One year of `expenses(motorcycleId, year)`: category → [date, amount] rows. */
export function expenseYear(categories: Record<string, Array<[date: string, amount: number]>>) {
  return {
    ytdTotal: 0,
    categories: Object.entries(categories).map(([category, rows]) => ({
      category,
      total: rows.reduce((acc, [, amount]) => acc + amount, 0),
      expenses: rows.map(([date, amount]) => {
        expenseId += 1;
        return { id: `e${expenseId}`, amount, category, currency: 'EUR', date, createdAt: date };
      }),
    })),
  };
}

/** Bike A, 2026: €1,960.62 — Insurance 25 %, then 20 / 13 / 12 / 12, rest 18. */
export const EXPENSES_2026 = expenseYear({
  insurance: [['2026-01-10', 490.16]],
  fuel: [
    ['2026-03-05', 326.5],
    ['2026-09-12', 65.62],
  ],
  maintenance: [['2026-07-16', 254.88]],
  gear: [['2026-05-02', 235.27]],
  tires: [['2026-04-20', 235.26]],
  parking: [['2026-06-01', 200]],
  tolls: [['2026-08-09', 152.93]],
});

/** 2025: €1,748.62 up to Oct 2, plus later spend that must not count. */
export const EXPENSES_2025 = expenseYear({
  insurance: [['2025-01-10', 480]],
  fuel: [
    ['2025-06-01', 1000],
    ['2025-10-02', 268.62],
    ['2025-10-03', 75],
    ['2025-12-20', 300],
  ],
});

function note(
  id: string,
  createdAt: string,
  odometer: number | null,
  text: string,
  links: Partial<{
    linkedTaskId: string;
    linkedTaskTitle: string;
    linkedExpenseId: string;
    linkedExpenseAmount: number;
    linkedExpenseCurrency: string;
  }> = {},
) {
  return {
    id,
    motorcycleId: BIKE_A.id,
    text,
    odometer,
    createdAt,
    updatedAt: createdAt,
    linkedTaskId: null,
    linkedTaskTitle: null,
    linkedExpenseId: null,
    linkedExpenseAmount: null,
    linkedExpenseCurrency: null,
    photos: [],
    ...links,
  };
}

/** The five notes of bike A, newest first. Dates at local noon so they never shift a day. */
export const NOTES = [
  note(
    'note-1',
    new Date(2026, 8, 28, 12).toISOString(),
    38_100,
    'Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.',
  ),
  note(
    'note-2',
    new Date(2026, 7, 26, 12).toISOString(),
    37_950,
    'Pattex Nural 50 on the pannier bracket, cured fine. Keep an eye on the left mount.',
    { linkedExpenseId: 'expense-1', linkedExpenseAmount: 29.73, linkedExpenseCurrency: 'EUR' },
  ),
  note(
    'note-3',
    new Date(2026, 7, 9, 12).toISOString(),
    36_400,
    'Front tyre pressure that feels right loaded: 2.5 bar. Honda says 2.25 unloaded.',
  ),
  note(
    'note-4',
    new Date(2026, 6, 20, 12).toISOString(),
    null,
    'Idea: heated grips before winter — Oxford Adventure.',
  ),
  note(
    'note-5',
    new Date(2026, 6, 16, 12).toISOString(),
    37_300,
    'Dealer (Motos Ebro) said the clutch lever free play should be 10–20 mm.',
    { linkedTaskId: 'task-service', linkedTaskTitle: '2nd scheduled service' },
  ),
];
