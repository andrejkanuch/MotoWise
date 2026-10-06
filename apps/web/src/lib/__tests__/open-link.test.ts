import { describe, expect, it } from 'vitest';
import { normalizeOpenFrom, OpenFrom, openGarageHref } from '../open-link';

describe('open-link', () => {
  it('builds the hand-off link for a placement', () => {
    expect(openGarageHref(OpenFrom.GarageEmpty)).toBe('/open/garage?from=garage_empty');
  });

  it('accepts known placements and buckets anything else as other', () => {
    expect(normalizeOpenFrom(' Welcome_QR ')).toBe(OpenFrom.WelcomeQr);
    expect(normalizeOpenFrom('newsletter')).toBe(OpenFrom.Other);
    expect(normalizeOpenFrom(null)).toBe(OpenFrom.Other);
  });
});
