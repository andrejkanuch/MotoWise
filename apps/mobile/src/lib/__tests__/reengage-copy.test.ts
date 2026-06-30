// MOT-275: the day-2 notification copy is goal-personalized. Pin that each V2
// goal maps to its own keys and that absent/legacy/unknown goals fall back to the
// default (the ridingGoals taxonomy is partly deprecated, so robustness matters).

import { RidingGoal } from '@motovault/types';
import { REENGAGE_COPY_DEFAULT, resolveReEngageCopyKeys } from '../reengage-copy';

describe('resolveReEngageCopyKeys', () => {
  it('returns goal-specific keys for each tailored V2 goal', () => {
    const cases: Array<[RidingGoal, string]> = [
      [RidingGoal.TRACK_RIDES, 'reengage.track_rides'],
      [RidingGoal.MANAGE_EXPENSES, 'reengage.manage_expenses'],
      [RidingGoal.DISCOVER_ROUTES, 'reengage.discover_routes'],
      [RidingGoal.MAINTAIN_BIKE, 'reengage.maintain_bike'],
      [RidingGoal.JUST_EXPLORING, 'reengage.just_exploring'],
    ];
    for (const [goal, prefix] of cases) {
      expect(resolveReEngageCopyKeys(goal)).toEqual({
        titleKey: `${prefix}.title`,
        bodyKey: `${prefix}.body`,
      });
    }
  });

  it('falls back to default for an absent goal', () => {
    expect(resolveReEngageCopyKeys(undefined)).toEqual(REENGAGE_COPY_DEFAULT);
  });

  it('falls back to default for an unrecognized / legacy goal', () => {
    expect(resolveReEngageCopyKeys('some_removed_goal')).toEqual(REENGAGE_COPY_DEFAULT);
    expect(resolveReEngageCopyKeys(RidingGoal.LEARN_MAINTENANCE)).toEqual(REENGAGE_COPY_DEFAULT);
  });
});
