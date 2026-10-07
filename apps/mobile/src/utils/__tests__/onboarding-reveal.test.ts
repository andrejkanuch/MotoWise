import { getRevealRiderCount } from '../onboarding-reveal';

describe('getRevealRiderCount', () => {
  it('hides the community line when there are no riders of the make', () => {
    expect(getRevealRiderCount(0)).toBeNull();
    expect(getRevealRiderCount(null)).toBeNull();
    expect(getRevealRiderCount(undefined)).toBeNull();
  });

  it('shows the real rider count', () => {
    expect(getRevealRiderCount(12)).toBe(12);
    expect(getRevealRiderCount(1)).toBe(1);
  });
});
