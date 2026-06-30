import { RidingGoal } from '@motovault/types';

/** i18n key pair for a re-engagement notification's title + body. */
export interface ReEngageCopyKeys {
  titleKey: string;
  bodyKey: string;
}

/** Generic copy when the user has no goal, or one we don't tailor for. */
export const REENGAGE_COPY_DEFAULT: ReEngageCopyKeys = {
  titleKey: 'reengage.default.title',
  bodyKey: 'reengage.default.body',
};

/**
 * Goal → copy-key dispatch map (MOT-275, KTD-4). Keys are i18n references the
 * caller resolves with `t()`. Only the V2 onboarding goals are tailored; every
 * other value (legacy V1 goals, unknown, or absent) falls back to the default.
 */
const REENGAGE_COPY_BY_GOAL: Partial<Record<RidingGoal, ReEngageCopyKeys>> = {
  [RidingGoal.TRACK_RIDES]: {
    titleKey: 'reengage.track_rides.title',
    bodyKey: 'reengage.track_rides.body',
  },
  [RidingGoal.MANAGE_EXPENSES]: {
    titleKey: 'reengage.manage_expenses.title',
    bodyKey: 'reengage.manage_expenses.body',
  },
  [RidingGoal.DISCOVER_ROUTES]: {
    titleKey: 'reengage.discover_routes.title',
    bodyKey: 'reengage.discover_routes.body',
  },
  [RidingGoal.MAINTAIN_BIKE]: {
    titleKey: 'reengage.maintain_bike.title',
    bodyKey: 'reengage.maintain_bike.body',
  },
  [RidingGoal.JUST_EXPLORING]: {
    titleKey: 'reengage.just_exploring.title',
    bodyKey: 'reengage.just_exploring.body',
  },
};

/**
 * Resolve the re-engagement copy keys for a user's primary goal. Robust to an
 * absent or unrecognized goal (the `ridingGoals` taxonomy is partly deprecated).
 */
export function resolveReEngageCopyKeys(goal: string | undefined): ReEngageCopyKeys {
  if (!goal) return REENGAGE_COPY_DEFAULT;
  return REENGAGE_COPY_BY_GOAL[goal as RidingGoal] ?? REENGAGE_COPY_DEFAULT;
}
