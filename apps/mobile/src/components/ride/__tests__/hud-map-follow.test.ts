// @rnmapbox/maps is a native module; mock the enum so the pure helper is testable.
jest.mock('@rnmapbox/maps', () => ({
  UserTrackingMode: {
    Follow: 'normal',
    FollowWithHeading: 'compass',
    FollowWithCourse: 'course',
  },
}));

import { UserTrackingMode } from '@rnmapbox/maps';
import { resolveFollowUserMode } from '../hud-map-follow';

describe('resolveFollowUserMode (U3/U4: heading-up with NaN guard)', () => {
  it('north-up preference always resolves to Follow, regardless of course', () => {
    expect(resolveFollowUserMode('north', true)).toBe(UserTrackingMode.Follow);
    expect(resolveFollowUserMode('north', false)).toBe(UserTrackingMode.Follow);
  });

  it('heading-up with a valid course resolves to FollowWithCourse', () => {
    expect(resolveFollowUserMode('heading', true)).toBe(UserTrackingMode.FollowWithCourse);
  });

  it('heading-up without a valid course stays north-up (NaN guard, R4)', () => {
    expect(resolveFollowUserMode('heading', false)).toBe(UserTrackingMode.Follow);
  });

  it('never resolves to the compass-based FollowWithHeading', () => {
    const modes = [
      resolveFollowUserMode('north', true),
      resolveFollowUserMode('north', false),
      resolveFollowUserMode('heading', true),
      resolveFollowUserMode('heading', false),
    ];
    expect(modes).not.toContain(UserTrackingMode.FollowWithHeading);
  });
});
