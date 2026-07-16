import type { MaintenancePriority } from '@motovault/graphql';
import { type MeasurementSystem, mileageFromDisplayUnit } from '@motovault/types';

/**
 * Pure helpers for the edit-maintenance-task screen, extracted so the
 * clear-vs-set input mapping and the reminder-reschedule decision can be unit
 * tested without rendering the React Native screen.
 */

export interface TaskEditFormValues {
  title: string;
  description: string;
  notes: string;
  /** Raw text-input string; empty means "clear". */
  targetMileage: string;
  priority: MaintenancePriority;
  /** Pre-formatted YYYY-MM-DD, or null when the rider cleared the due date. */
  dueDateISO: string | null;
}

/**
 * Build the `UpdateMaintenanceTaskInput` payload. Editable text fields the
 * rider can empty (description, notes, mileage, due date) are sent as `null`
 * to clear the stored value — the server's `update` treats `null` (defined)
 * as an explicit clear and `undefined` as "leave unchanged". Title is never
 * cleared (the save button stays disabled while it is blank).
 *
 * `targetMileage` is persisted as canonical kilometres; the rider types it in
 * their measurement system's unit, so it is converted to km here on write.
 */
export function buildTaskUpdateInput(values: TaskEditFormValues, system: MeasurementSystem) {
  const trimmedDescription = values.description.trim();
  const trimmedNotes = values.notes.trim();
  return {
    title: values.title.trim(),
    description: trimmedDescription.length > 0 ? trimmedDescription : null,
    notes: trimmedNotes.length > 0 ? trimmedNotes : null,
    targetMileage: values.targetMileage
      ? Math.round(mileageFromDisplayUnit(Number.parseInt(values.targetMileage, 10), system))
      : null,
    priority: values.priority,
    dueDate: values.dueDateISO,
  };
}

export type ReminderAction = 'schedule' | 'cancel';

/**
 * Decide what to do with the task's local reminder after an edit: schedule
 * (which also cancels prior stages) when a due date is present, otherwise
 * cancel any pending stages so a stale reminder can't fire.
 */
export function resolveReminderAction(dueDate: Date | null): ReminderAction {
  return dueDate ? 'schedule' : 'cancel';
}
