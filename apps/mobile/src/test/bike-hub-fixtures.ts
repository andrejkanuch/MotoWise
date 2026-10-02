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
