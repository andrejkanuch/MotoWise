import {
  MAINTENANCE_COMPLETION,
  MAINTENANCE_COMPLETION_SOURCE,
  MAINTENANCE_COMPLETION_SURFACE,
  OEM_IMPORT_CONTEXT,
} from '../maintenance-analytics';

/**
 * `maintenance_task_completed` carries `surface` (where the tap was) and, since
 * issue 365 T05d, `source` in the board's vocabulary (board/05 P05.2:
 * `plate_sheet | task_screen | other`), so completions a future plate sheet
 * writes can be read apart from the ones the rider logs.
 */
describe('maintenance_task_completed properties', () => {
  it('the complete-task screen is the task screen', () => {
    expect(MAINTENANCE_COMPLETION.COMPLETE_TASK_SCREEN).toEqual({
      surface: MAINTENANCE_COMPLETION_SURFACE.COMPLETE_TASK_SCREEN,
      source: MAINTENANCE_COMPLETION_SOURCE.TASK_SCREEN,
    });
    expect(MAINTENANCE_COMPLETION_SOURCE.TASK_SCREEN).toBe('task_screen');
  });

  it('a reminder notification "Mark done" is other', () => {
    expect(MAINTENANCE_COMPLETION.REMINDER_NOTIFICATION).toEqual({
      surface: MAINTENANCE_COMPLETION_SURFACE.REMINDER_NOTIFICATION,
      source: MAINTENANCE_COMPLETION_SOURCE.OTHER,
    });
  });
});

describe('oem_schedule_imported context', () => {
  it('names the bike hub', () => {
    expect(OEM_IMPORT_CONTEXT.BIKE_HUB).toBe('bike_hub');
  });
});
