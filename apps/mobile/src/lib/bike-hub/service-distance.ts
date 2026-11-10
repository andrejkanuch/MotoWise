import { MaintenanceTaskStatus } from '@motovault/graphql';
import type { HubTask } from './task-due';

export interface ServiceDistance {
  /** Distance since the last logged service, raw in the bike's unit. */
  distance: number;
  /** The odometer the latest service was logged at. */
  serviceOdometer: number;
}

type ServiceTask = Pick<HubTask, 'status' | 'completedAt' | 'completedMileage'>;

/**
 * The bike's current odometer minus the odometer on its latest completed
 * service that recorded one. `null` when no such service exists (or the bike
 * has no odometer). Both values are in the bike's own unit: nothing converts.
 */
export function distanceSinceLastService(
  tasks: readonly ServiceTask[],
  currentOdometer: number | null | undefined,
): ServiceDistance | null {
  if (currentOdometer == null) return null;
  let latest: { at: number; odometer: number } | null = null;
  for (const task of tasks) {
    if (task.status !== MaintenanceTaskStatus.Completed || task.completedMileage == null) continue;
    const at = task.completedAt ? Date.parse(task.completedAt) : Number.NEGATIVE_INFINITY;
    if (!latest || at > latest.at) latest = { at, odometer: task.completedMileage };
  }
  if (!latest) return null;
  return {
    distance: Math.max(0, currentOdometer - latest.odometer),
    serviceOdometer: latest.odometer,
  };
}
