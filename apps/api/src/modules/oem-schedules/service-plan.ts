import type { MeasurementSystem } from '@motovault/types';
import type { OemSchedule } from './models/oem-schedule.model';

/** `oem_maintenance_schedules.make` of the last-resort waterfall tier. */
export const GENERIC_SCHEDULE_MAKE = 'GENERIC' as const;

/**
 * Which waterfall tier a bike's service plan came from (#365 T07a). `make` is the
 * make-generic plan the app labels as such; `generic` is the GENERIC fallback.
 */
export const SERVICE_PLAN_TIER = {
  MODEL: 'model',
  MAKE: 'make',
  GENERIC: 'generic',
} as const;
export type ServicePlanTier = (typeof SERVICE_PLAN_TIER)[keyof typeof SERVICE_PLAN_TIER];

/** The tier of a resolved plan, or `null` when the plan is empty. */
export function servicePlanTierOf(
  schedules: ReadonlyArray<Pick<OemSchedule, 'make' | 'model'>>,
): ServicePlanTier | null {
  if (schedules.length === 0) return null;
  if (schedules.some((s) => s.model)) return SERVICE_PLAN_TIER.MODEL;
  if (schedules.every((s) => s.make === GENERIC_SCHEDULE_MAKE)) return SERVICE_PLAN_TIER.GENERIC;
  return SERVICE_PLAN_TIER.MAKE;
}

/** What `OemSchedulesService.importServicePlan` gets for one bike. */
export interface ServicePlanImportParams {
  userId: string;
  motorcycleId: string;
  make: string;
  model: string | null;
  year: number | null;
  engineCc: number | null;
  /** Raw odometer, in the rider's measurement-system unit. */
  currentMileage?: number;
  /** Import exactly these schedule ids (still gated) instead of the waterfall. */
  scheduleIdFilter?: string[];
  variant?: string | null;
  /**
   * The rider's unit when the caller knows it better than `users.measurement_system`
   * (onboarding: the client writes the unit only after `completeOnboarding`).
   */
  measurementSystem?: MeasurementSystem;
}

export interface ServicePlanImport {
  /** OEM tasks of this plan the bike has after the import (new + already there). */
  taskCount: number;
  /** Tasks this call inserted; 0 on a re-run (dedup by `oem_schedule_id`). */
  insertedCount: number;
  tier: ServicePlanTier | null;
  measurementSystem: MeasurementSystem;
}
