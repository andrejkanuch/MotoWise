import type { TFunction } from 'i18next';
import type { PeriodOfDay } from '../../utils/period-of-day';

/** Ride-character label per difficulty ("Chill", "Spirited", ...). */
const DIFFICULTY_LABEL_KEY = {
  easy: 'trips.difficultyEasy',
  moderate: 'trips.difficultyModerate',
  challenging: 'trips.difficultyChallenging',
  expert: 'trips.difficultyExpert',
} as const;

const SURFACE_LABEL_KEY = {
  paved: 'trips.surfacePaved',
  mixed: 'trips.surfaceMixed',
  off_road: 'trips.surfaceOffRoad',
  gravel: 'trips.surfaceGravel',
} as const;

const VISIBILITY_CHIP_KEY = {
  public: 'trips.visibilityChipPublic',
  unlisted: 'trips.visibilityChipUnlisted',
  private: 'trips.visibilityChipPrivate',
} as const;

const PERIOD_LABEL_KEY = {
  morning: 'tripSuggestions.period.morning',
  afternoon: 'tripSuggestions.period.afternoon',
  evening: 'tripSuggestions.period.evening',
} as const satisfies Record<PeriodOfDay, string>;

const isKeyOf = <T extends object>(map: T, key: string): key is Extract<keyof T, string> =>
  Object.hasOwn(map, key);

/** A trip's difficulty in the app language; an unknown value reads as the easiest. */
export function tripDifficultyLabel(t: TFunction, difficulty: string | null | undefined): string {
  const key = (difficulty ?? '').toLowerCase();
  return t(
    isKeyOf(DIFFICULTY_LABEL_KEY, key) ? DIFFICULTY_LABEL_KEY[key] : DIFFICULTY_LABEL_KEY.easy,
  );
}

/** A route surface in the app language; an unknown surface is shown as stored. */
export function tripSurfaceLabel(t: TFunction, surface: string): string {
  return isKeyOf(SURFACE_LABEL_KEY, surface) ? t(SURFACE_LABEL_KEY[surface]) : surface;
}

/** The visibility chip; anything that is not public or link-only reads as private. */
export function tripVisibilityLabel(t: TFunction, visibility: string | null | undefined): string {
  const key = visibility ?? '';
  return t(
    isKeyOf(VISIBILITY_CHIP_KEY, key) ? VISIBILITY_CHIP_KEY[key] : VISIBILITY_CHIP_KEY.private,
  );
}

/** The period-of-day heading over a group of stops. */
export function tripPeriodLabel(t: TFunction, period: PeriodOfDay): string {
  return t(PERIOD_LABEL_KEY[period]);
}

/** "Day 2", or "Day 2 · Jun 15" when the trip has real dates. */
export function tripDayHeader(
  t: TFunction,
  dayIndex: number,
  start: string | null | undefined,
  locale: string,
): string {
  const day = dayIndex + 1;
  if (!start) return t('trips.dayHeaderShort', { day });
  const date = new Date(start);
  date.setDate(date.getDate() + dayIndex);
  const formatted = date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return t('trips.dayHeader', { day, date: formatted });
}
