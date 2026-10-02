jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import { MaintenancePriority, MaintenanceTaskSource } from '@motovault/graphql';
import { addDays, format } from 'date-fns';
import i18n from '../../../i18n';
import {
  DUE_STATE,
  DUE_TONE,
  type DueState,
  type DueTone,
  HUB_UNIT,
} from '../../../lib/bike-hub/constants';
import { type DueContext, getTaskDue } from '../../../lib/bike-hub/task-due';
import { AIR_FILTER, BRAKE_PADS, KM, ODOMETER, TODAY, task } from '../../../test/bike-hub-fixtures';
import { describeDue } from '../ui/due-line';

const LANGUAGE = 'en';
const SEPARATOR = ' · ';
const MI_ODOMETER = 10_000;
const MI: DueContext = { odometer: MI_ODOMETER, today: TODAY, unit: HUB_UNIT.MI };
const NO_ODOMETER: DueContext = { ...KM, odometer: null };

const iso = (deltaDays: number): string => format(addDays(TODAY, deltaDays), 'yyyy-MM-dd');

type TaskOverrides = Partial<Parameters<typeof task>[0]>;
const a = (overrides: TaskOverrides) => task({ id: 'a', title: 'Task', ...overrides });
const oem = (overrides: TaskOverrides) => a({ ...overrides, source: MaintenanceTaskSource.Oem });

interface Line {
  text: string;
  tone: DueTone;
  state: DueState;
  secondaryLate: boolean;
}

/** The due line as the rider reads it, plus what colours it. */
function line(
  input: ReturnType<typeof task>,
  context: DueContext,
  scheduleName: string | null = 'Honda',
): Line {
  const due = getTaskDue(input, context);
  const copy = describeDue(due, {
    t: i18n.t.bind(i18n),
    unit: context.unit,
    language: LANGUAGE,
    scheduleName,
  });
  return {
    text: [copy.primary, copy.secondary].filter(Boolean).join(SEPARATOR),
    tone: due.tone,
    state: due.state,
    secondaryLate: copy.secondaryLate,
  };
}

beforeAll(async () => {
  await i18n.changeLanguage(LANGUAGE);
});

describe('due line — the plan’s due-line table, exact copy', () => {
  it('Brake pads inspection [km]: "201 days late · 3,933 km to target", late', () => {
    expect(line(BRAKE_PADS, KM)).toEqual({
      text: '201 days late · 3,933 km to target',
      tone: DUE_TONE.LATE,
      state: DUE_STATE.OVERDUE,
      secondaryLate: false,
    });
  });

  it('Air filter [km]: "In 2 days · or in 8,733 km", soon', () => {
    expect(line(AIR_FILTER, KM)).toEqual({
      text: 'In 2 days · or in 8,733 km',
      tone: DUE_TONE.SOON,
      state: DUE_STATE.SOON,
      secondaryLate: false,
    });
  });

  it('Rear brake shoes [mi]: "38 days late · 420 mi past target", both parts late', () => {
    const shoes = a({
      priority: MaintenancePriority.Critical,
      dueDate: iso(-38),
      targetMileage: MI_ODOMETER - 420,
    });
    expect(line(shoes, MI)).toEqual({
      text: '38 days late · 420 mi past target',
      tone: DUE_TONE.LATE,
      state: DUE_STATE.OVERDUE,
      secondaryLate: true,
    });
  });

  it('Chain tension [mi]: "12 days late · 180 mi to target", only the date is late', () => {
    const chain = a({
      priority: MaintenancePriority.Low,
      dueDate: iso(-12),
      targetMileage: MI_ODOMETER + 180,
    });
    expect(line(chain, MI)).toEqual({
      text: '12 days late · 180 mi to target',
      tone: DUE_TONE.LATE,
      state: DUE_STATE.OVERDUE,
      secondaryLate: false,
    });
  });

  it('Engine oil & filter [km]: "In 1,833 km · or by Jan 10", soon', () => {
    const oil = a({
      priority: MaintenancePriority.High,
      dueDate: '2027-01-10',
      targetMileage: 40_000,
    });
    expect(line(oil, KM)).toMatchObject({
      text: 'In 1,833 km · or by Jan 10',
      tone: DUE_TONE.SOON,
    });
  });

  it('Brake fluid [km]: "Mar 2027 · Honda schedule", plain', () => {
    expect(line(oem({ dueDate: '2027-03-15' }), KM)).toMatchObject({
      text: 'Mar 2027 · Honda schedule',
      tone: DUE_TONE.PLAIN,
      state: DUE_STATE.LATER,
    });
  });

  it('OEM task [km]: "In 9,833 km · Honda schedule", plain', () => {
    expect(line(oem({ targetMileage: 48_000 }), KM)).toMatchObject({
      text: 'In 9,833 km · Honda schedule',
      tone: DUE_TONE.PLAIN,
      state: DUE_STATE.LATER,
    });
  });

  it('undated task without a target: SOMEDAY, "No due date"', () => {
    expect(line(a({}), KM)).toEqual({
      text: 'No due date',
      tone: DUE_TONE.PLAIN,
      state: DUE_STATE.SOMEDAY,
      secondaryLate: false,
    });
  });
});

describe('due line — thresholds, at and just past the boundary', () => {
  it.each([
    [1_200, 'In 1,200 mi', DUE_TONE.SOON, DUE_STATE.SOON],
    [1_201, 'In 1,201 mi', DUE_TONE.PLAIN, DUE_STATE.LATER],
  ])('[mi] %i mi ahead reads "%s" in the %s tone', (ahead, text, tone, state) => {
    expect(line(a({ targetMileage: MI_ODOMETER + ahead }), MI)).toMatchObject({
      text,
      tone,
      state,
    });
  });

  it.each([
    [2_000, 'In 2,000 km', DUE_TONE.SOON, DUE_STATE.SOON],
    [2_001, 'In 2,001 km', DUE_TONE.PLAIN, DUE_STATE.LATER],
  ])('[km] %i km ahead reads "%s" in the %s tone', (ahead, text, tone, state) => {
    expect(line(a({ targetMileage: ODOMETER + ahead }), KM)).toMatchObject({ text, tone, state });
  });

  it.each([
    // 2026-10-02 + 30 days = Nov 1; + 31 days = Nov 2, worded as a date.
    [30, 'In 30 days', DUE_TONE.SOON, DUE_STATE.SOON],
    [31, 'Nov 2', DUE_TONE.PLAIN, DUE_STATE.LATER],
  ])('[km] %i days ahead reads "%s" in the %s tone', (days, text, tone, state) => {
    expect(line(a({ dueDate: iso(days) }), KM)).toMatchObject({ text, tone, state });
  });

  it('the miles threshold is not applied to a km bike: 1,201 km ahead is still soon', () => {
    expect(line(a({ targetMileage: ODOMETER + 1_201 }), KM).tone).toBe(DUE_TONE.SOON);
  });

  it('the km threshold is not applied to a miles bike: 2,000 mi ahead is plain', () => {
    expect(line(a({ targetMileage: MI_ODOMETER + 2_000 }), MI).tone).toBe(DUE_TONE.PLAIN);
  });
});

describe('due line — around today', () => {
  it.each([
    [-2, '2 days late', DUE_TONE.LATE],
    [-1, '1 day late', DUE_TONE.LATE],
    [0, 'Due today', DUE_TONE.SOON],
    [1, 'In 1 day', DUE_TONE.SOON],
    [2, 'In 2 days', DUE_TONE.SOON],
  ])('a date %i days from today reads "%s"', (days, text, tone) => {
    expect(line(a({ dueDate: iso(days) }), KM)).toMatchObject({ text, tone });
  });

  it('a date far ahead is worded at day precision, then at month precision', () => {
    expect(line(a({ dueDate: '2027-01-10' }), KM).text).toBe('Jan 10');
    expect(line(a({ dueDate: '2027-03-15' }), KM).text).toBe('Mar 2027');
  });
});

describe('due line — which limit leads', () => {
  it('a passed target leads over a date that is still ahead', () => {
    const passed = a({ dueDate: iso(5), targetMileage: ODOMETER - 500 });
    expect(line(passed, KM)).toEqual({
      text: '500 km past target · due in 5 days',
      tone: DUE_TONE.LATE,
      state: DUE_STATE.OVERDUE,
      secondaryLate: false,
    });
  });

  it('a passed target with the date today reads "due today"', () => {
    const passed = a({ dueDate: iso(0), targetMileage: ODOMETER - 500 });
    expect(line(passed, KM).text).toBe('500 km past target · due today');
  });

  it('a passed target with a date beyond the window names the date', () => {
    const passed = a({ dueDate: '2027-01-10', targetMileage: ODOMETER - 500 });
    expect(line(passed, KM).text).toBe('500 km past target · due Jan 10');
  });

  it('when both have passed the date leads and the distance follows in red', () => {
    const both = a({ dueDate: iso(-3), targetMileage: ODOMETER - 9_000 });
    expect(line(both, KM)).toMatchObject({
      text: '3 days late · 9,000 km past target',
      secondaryLate: true,
    });
  });

  it('the nearer date leads and the distance follows', () => {
    const dateFirst = a({ dueDate: iso(3), targetMileage: ODOMETER + 1_900 });
    expect(line(dateFirst, KM).text).toBe('In 3 days · or in 1,900 km');
  });

  it('the nearer distance leads and a close date follows as days', () => {
    const distanceFirst = a({ dueDate: iso(29), targetMileage: ODOMETER + 100 });
    expect(line(distanceFirst, KM).text).toBe('In 100 km · or in 29 days');
  });

  it('a date today leads even over a target 1 km away', () => {
    const dueToday = a({ dueDate: iso(0), targetMileage: ODOMETER + 1 });
    expect(line(dueToday, KM).text).toBe('Due today · or in 1 km');
  });

  it('an exact tie between the two limits goes to the date', () => {
    // 15 days is half the 30-day window; 1,000 km is half the 2,000 km one.
    const tie = a({ dueDate: iso(15), targetMileage: ODOMETER + 1_000 });
    expect(line(tie, KM).text).toBe('In 15 days · or in 1,000 km');
  });
});

describe('due line — schedule and odometer edges', () => {
  it('names the schedule only for a task with a single limit', () => {
    const twoLimits = oem({ dueDate: iso(3), targetMileage: ODOMETER + 5_000 });
    expect(line(twoLimits, KM).text).toBe('In 3 days · or in 5,000 km');
  });

  it('falls back to "Manufacturer schedule" when the make is unknown', () => {
    expect(line(oem({ targetMileage: 48_000 }), KM, null).text).toBe(
      'In 9,833 km · Manufacturer schedule',
    );
  });

  it('an undated OEM task still names its schedule', () => {
    expect(line(oem({}), KM).text).toBe('No due date · Honda schedule');
  });

  it('a task the rider added never names a schedule', () => {
    expect(line(a({ targetMileage: 48_000 }), KM).text).toBe('In 9,833 km');
  });

  it('a bike without an odometer shows the bare target and never calls it soon', () => {
    expect(line(a({ targetMileage: 12_000 }), NO_ODOMETER)).toMatchObject({
      text: 'At 12,000 km',
      tone: DUE_TONE.PLAIN,
      state: DUE_STATE.LATER,
    });
  });

  it('a bike without an odometer: the date leads and the target follows as written', () => {
    const upcoming = a({ dueDate: iso(10), targetMileage: 12_000 });
    const overdue = a({ dueDate: iso(-5), targetMileage: 12_000 });
    expect(line(upcoming, NO_ODOMETER).text).toBe('In 10 days · or at 12,000 km');
    expect(line(overdue, NO_ODOMETER).text).toBe('5 days late · target 12,000 km');
  });

  it('miles are shown as stored — 23,716 mi is never turned into km', () => {
    const context: DueContext = { odometer: 23_716, today: TODAY, unit: HUB_UNIT.MI };
    expect(line(a({ targetMileage: 24_000 }), context).text).toBe('In 284 mi');
  });
});
