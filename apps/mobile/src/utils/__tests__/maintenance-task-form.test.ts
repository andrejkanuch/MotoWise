import type { MaintenancePriority } from '@motovault/graphql';
import {
  buildTaskUpdateInput,
  resolveReminderAction,
  type TaskEditFormValues,
} from '../maintenance-task-form';

const baseValues: TaskEditFormValues = {
  title: 'Oil change',
  description: '',
  notes: '',
  targetMileage: '',
  priority: 'medium' as MaintenancePriority,
  dueDateISO: null,
};

describe('buildTaskUpdateInput', () => {
  it('trims the title and keeps a set priority', () => {
    const input = buildTaskUpdateInput({ ...baseValues, title: '  Chain lube  ' }, 'metric');
    expect(input.title).toBe('Chain lube');
    expect(input.priority).toBe('medium');
  });

  it('sends null (clear) for empty description, notes, mileage, and due date', () => {
    const input = buildTaskUpdateInput(baseValues, 'metric');
    expect(input.description).toBeNull();
    expect(input.notes).toBeNull();
    expect(input.targetMileage).toBeNull();
    expect(input.dueDate).toBeNull();
  });

  it('sends set values when fields are populated (metric = km as typed)', () => {
    const input = buildTaskUpdateInput(
      {
        ...baseValues,
        description: '  Replace filter  ',
        notes: '  Torque to spec  ',
        targetMileage: '12000',
        dueDateISO: '2026-08-01',
      },
      'metric',
    );
    expect(input.description).toBe('Replace filter');
    expect(input.notes).toBe('Torque to spec');
    expect(input.targetMileage).toBe(12000);
    expect(input.dueDate).toBe('2026-08-01');
  });

  it('converts the typed miles value to canonical km on imperial', () => {
    const input = buildTaskUpdateInput({ ...baseValues, targetMileage: '1000' }, 'imperial');
    expect(input.targetMileage).toBe(1609); // round(1000 * 1.609344)
  });

  it('parses mileage as a base-10 integer', () => {
    const input = buildTaskUpdateInput({ ...baseValues, targetMileage: '08000' }, 'metric');
    expect(input.targetMileage).toBe(8000);
  });
});

describe('resolveReminderAction', () => {
  it('schedules when a due date is present', () => {
    expect(resolveReminderAction(new Date('2026-08-01T00:00:00'))).toBe('schedule');
  });

  it('cancels when the due date was cleared', () => {
    expect(resolveReminderAction(null)).toBe('cancel');
  });

  it('still schedules for a past due date (scheduler applies its own window guard)', () => {
    expect(resolveReminderAction(new Date('2000-01-01T00:00:00'))).toBe('schedule');
  });
});
