import { ODOMETER_MAX } from '@motovault/types';
import { differenceInCalendarDays } from 'date-fns';
import {
  DELTA_DIRECTION,
  type DeltaDirection,
  ODOMETER_CONFIRM,
  ODOMETER_ERROR,
  ODOMETER_KEY,
  ODOMETER_MAX_DIGITS,
  type OdometerConfirm,
  type OdometerError,
  type OdometerKey,
} from './constants';

const KEY_HANDLERS: Record<
  (typeof ODOMETER_KEY)[keyof typeof ODOMETER_KEY],
  (digits: string) => string
> = {
  [ODOMETER_KEY.DELETE]: (digits) => digits.slice(0, -1),
  [ODOMETER_KEY.CLEAR]: () => '',
};

function isControlKey(key: OdometerKey): key is keyof typeof KEY_HANDLERS {
  return key in KEY_HANDLERS;
}

/**
 * Next keypad entry after a key press. At most `ODOMETER_MAX_DIGITS` digits and
 * no leading zero: a lone "0" is replaced by the next digit.
 */
export function applyKey(digits: string, key: OdometerKey): string {
  if (isControlKey(key)) return KEY_HANDLERS[key](digits);
  if (digits === '0') return key;
  if (digits.length >= ODOMETER_MAX_DIGITS) return digits;
  return `${digits}${key}`;
}

/** The keypad entry as a number; `null` when nothing is entered. */
export function parseEntry(digits: string): number | null {
  return digits === '' ? null : Number.parseInt(digits, 10);
}

/**
 * A quick-add chip adds to the current entry; from an empty entry it adds to the
 * last reading. Capped at `ODOMETER_MAX`.
 */
export function applyQuickAdd(
  entry: number | null,
  lastValue: number | null | undefined,
  delta: number,
): number {
  return Math.min(ODOMETER_MAX, (entry ?? lastValue ?? 0) + delta);
}

export type ReadingValidation =
  | { ok: true; backdated: boolean }
  | { ok: false; needsConfirm: OdometerConfirm }
  | { ok: false; error: OdometerError };

export interface ReadingInput {
  value: number | null;
  lastValue: number | null | undefined;
  recordedAt: Date;
  lastRecordedAt: Date | null | undefined;
  today: Date;
}

/**
 * Checks a reading before it is saved. A reading dated before the latest one is
 * history being filled in — it is accepted as is and does not move the bike's
 * odometer. Otherwise an unchanged value is rejected and a lower one needs the
 * rider's confirmation (a typo must stay correctable).
 */
export function validateReading(input: ReadingInput): ReadingValidation {
  const { value, lastValue, recordedAt, lastRecordedAt, today } = input;
  if (value === null) return { ok: false, error: ODOMETER_ERROR.EMPTY };
  if (differenceInCalendarDays(recordedAt, today) > 0) {
    return { ok: false, error: ODOMETER_ERROR.FUTURE_DATE };
  }
  const backdated = !!lastRecordedAt && differenceInCalendarDays(recordedAt, lastRecordedAt) < 0;
  if (backdated || lastValue == null) return { ok: true, backdated };
  if (value === lastValue) return { ok: false, error: ODOMETER_ERROR.UNCHANGED };
  if (value < lastValue) return { ok: false, needsConfirm: ODOMETER_CONFIRM.LOWER_THAN_LAST };
  return { ok: true, backdated: false };
}

export interface OdometerDelta {
  direction: DeltaDirection;
  /** Absolute difference to the last reading. */
  amount: number;
}

/** Difference between the entry and the last reading; `null` without a last reading. */
export function describeDelta(
  value: number | null,
  lastValue: number | null | undefined,
): OdometerDelta | null {
  if (value === null || lastValue == null) return null;
  const difference = value - lastValue;
  if (difference === 0) return { direction: DELTA_DIRECTION.FLAT, amount: 0 };
  return {
    direction: difference > 0 ? DELTA_DIRECTION.UP : DELTA_DIRECTION.DOWN,
    amount: Math.abs(difference),
  };
}
