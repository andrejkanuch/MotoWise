import { describe, expect, it } from 'vitest';
import { reviewsBlockRender } from '../reviews-gate';

describe('reviewsBlockRender', () => {
  it('fails the render of a rated trip whose reviews did not load', () => {
    expect(reviewsBlockRender(true, null)).toBe(true);
  });

  it('renders a rated trip whose reviews are ratings only', () => {
    expect(reviewsBlockRender(true, [])).toBe(false);
  });

  it('renders an unrated trip whatever the reviews fetch did', () => {
    expect(reviewsBlockRender(false, null)).toBe(false);
  });
});
