import { parseISO } from 'date-fns';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Text, type TextStyle } from 'react-native';
import {
  DUE_DIMENSION,
  DUE_DIRECTION,
  DUE_DISPLAY,
  type DueDisplay,
  type HubUnit,
} from '@/lib/bike-hub/constants';
import { formatOdometer } from '@/lib/bike-hub/format';
import type { DueLimit, TaskDue } from '@/lib/bike-hub/task-due';
import { DUE_TONE_COLOR, HUB_ROW_SUB_LINES, SYSTEM_WEIGHT, useHubTheme } from './tokens';

interface CopyContext {
  t: TFunction;
  unit: HubUnit;
  language: string;
}

type LimitCopy = (limit: DueLimit, context: CopyContext) => string;

const DATE_FORMAT: Partial<Record<DueDisplay, Intl.DateTimeFormatOptions>> = {
  [DUE_DISPLAY.DAY]: { month: 'short', day: 'numeric' },
  [DUE_DISPLAY.MONTH]: { month: 'short', year: 'numeric' },
};

function formatDate(limit: DueLimit, language: string): string {
  if (!limit.date) return '';
  return parseISO(limit.date).toLocaleDateString(language, DATE_FORMAT[limit.display]);
}

function distanceValues(limit: DueLimit, { unit, language }: CopyContext) {
  return { distance: formatOdometer(limit.amount, language), unit };
}

function isRelative(limit: DueLimit): boolean {
  return limit.display === DUE_DISPLAY.RELATIVE;
}

/** The leading part: "201 days late", "In 2 days", "Mar 2027", "In 1,833 km". */
const PRIMARY_COPY: Record<string, LimitCopy> = {
  [`${DUE_DIMENSION.TIME}:${DUE_DIRECTION.PAST}`]: (limit, { t }) =>
    t('bikeHub.due.daysLate', { count: limit.amount }),
  [`${DUE_DIMENSION.TIME}:${DUE_DIRECTION.AHEAD}`]: (limit, { t, language }) => {
    if (!isRelative(limit)) return formatDate(limit, language);
    if (limit.amount === 0) return t('bikeHub.due.today');
    return t('bikeHub.due.inDays', { count: limit.amount });
  },
  // Exactly at the target the task is due, but nothing is "past" yet: say so
  // instead of "0 km past target". (A date has no such case: due today is not late.)
  [`${DUE_DIMENSION.DISTANCE}:${DUE_DIRECTION.PAST}`]: (limit, context) =>
    limit.amount === 0
      ? context.t('bikeHub.due.dueNow')
      : context.t('bikeHub.due.pastTarget', distanceValues(limit, context)),
  [`${DUE_DIMENSION.DISTANCE}:${DUE_DIRECTION.AHEAD}`]: (limit, context) =>
    isRelative(limit)
      ? context.t('bikeHub.due.inDistance', distanceValues(limit, context))
      : context.t('bikeHub.due.atDistance', distanceValues(limit, context)),
};

/** The other limit when the leading one is still ahead: "or in 8,733 km", "or by Jan 10". */
const SECONDARY_AFTER_AHEAD: Record<string, LimitCopy> = {
  [DUE_DIMENSION.TIME]: (limit, { t, language }) => {
    if (!isRelative(limit)) return t('bikeHub.due.orBy', { date: formatDate(limit, language) });
    if (limit.amount === 0) return t('bikeHub.due.orToday');
    return t('bikeHub.due.orInDays', { count: limit.amount });
  },
  [DUE_DIMENSION.DISTANCE]: (limit, context) =>
    isRelative(limit)
      ? context.t('bikeHub.due.orInDistance', distanceValues(limit, context))
      : context.t('bikeHub.due.orAtDistance', distanceValues(limit, context)),
};

/** The other limit when the leading one has passed: "3,933 km to target", "420 mi past target". */
const SECONDARY_AFTER_PAST: Record<string, LimitCopy> = {
  [`${DUE_DIMENSION.TIME}:${DUE_DIRECTION.AHEAD}`]: (limit, { t, language }) => {
    if (!isRelative(limit)) return t('bikeHub.due.dueBy', { date: formatDate(limit, language) });
    if (limit.amount === 0) return t('bikeHub.due.dueToday');
    return t('bikeHub.due.dueInDays', { count: limit.amount });
  },
  [`${DUE_DIMENSION.DISTANCE}:${DUE_DIRECTION.PAST}`]: (limit, context) =>
    limit.amount === 0
      ? context.t('bikeHub.due.targetReached')
      : context.t('bikeHub.due.pastTarget', distanceValues(limit, context)),
  [`${DUE_DIMENSION.DISTANCE}:${DUE_DIRECTION.AHEAD}`]: (limit, context) =>
    isRelative(limit)
      ? context.t('bikeHub.due.toTarget', distanceValues(limit, context))
      : context.t('bikeHub.due.targetAt', distanceValues(limit, context)),
};

function limitKey(limit: DueLimit): string {
  return `${limit.dimension}:${limit.direction}`;
}

function secondaryCopy(primary: DueLimit, secondary: DueLimit, context: CopyContext): string {
  const copy =
    primary.direction === DUE_DIRECTION.PAST
      ? SECONDARY_AFTER_PAST[limitKey(secondary)]
      : SECONDARY_AFTER_AHEAD[secondary.dimension];
  return copy ? copy(secondary, context) : '';
}

export interface DueLineCopy {
  primary: string;
  secondary: string | null;
  /** True when the secondary limit has passed too — it is then drawn in the late colour. */
  secondaryLate: boolean;
}

interface DescribeDueOptions extends CopyContext {
  /** The bike's make, for "Honda schedule". */
  scheduleName?: string | null;
}

/**
 * Turns `getTaskDue` output into copy. Leads with the limit `getTaskDue` put
 * first; the other limit follows in grey, or the schedule the task came from
 * when it has only one limit.
 */
export function describeDue(due: TaskDue, options: DescribeDueOptions): DueLineCopy {
  const { t, scheduleName } = options;
  const schedule = due.fromSchedule
    ? scheduleName
      ? t('bikeHub.due.schedule', { make: scheduleName })
      : t('bikeHub.due.scheduleGeneric')
    : null;

  if (!due.primary) {
    return { primary: t('bikeHub.due.someday'), secondary: schedule, secondaryLate: false };
  }
  const primaryCopy = PRIMARY_COPY[limitKey(due.primary)];
  const primary = primaryCopy ? primaryCopy(due.primary, options) : '';
  if (!due.secondary) return { primary, secondary: schedule, secondaryLate: false };
  return {
    primary,
    secondary: secondaryCopy(due.primary, due.secondary, options),
    secondaryLate: due.secondary.direction === DUE_DIRECTION.PAST,
  };
}

interface DueLineProps {
  due: TaskDue;
  /** The bike's unit — a label only, nothing is converted. */
  unit: HubUnit;
  scheduleName?: string | null;
  style?: TextStyle;
}

const SEPARATOR = ' · ';

/** "201 days late · 3,933 km to target" — leading part in the tone colour, the rest muted. */
export function DueLine({ due, unit, scheduleName, style }: DueLineProps) {
  const hub = useHubTheme();
  const { t, i18n } = useTranslation();
  const copy = describeDue(due, { t, unit, language: i18n.language, scheduleName });
  return (
    <Text
      numberOfLines={HUB_ROW_SUB_LINES}
      style={[{ ...SYSTEM_WEIGHT.regular, fontSize: 13, lineHeight: 16 }, style]}
    >
      <Text style={{ color: hub[DUE_TONE_COLOR[due.tone]] }}>{copy.primary}</Text>
      {copy.secondary ? (
        <Text style={{ color: copy.secondaryLate ? hub.late : hub.muted }}>
          {SEPARATOR}
          {copy.secondary}
        </Text>
      ) : null}
    </Text>
  );
}
