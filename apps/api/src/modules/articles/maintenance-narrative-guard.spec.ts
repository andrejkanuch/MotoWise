import { findDigitViolations, isDigitFreeNarrative } from '@motovault/types';
import { describe, expect, it } from 'vitest';

/**
 * No-digit guard (KTD 5) — allowlist, not unit denylist. Any standalone digit
 * in any narrative string field is rejected. The reject fixtures are the exact
 * numeric forms a unit denylist provably misses (verified against the existing
 * CBR maintenance article).
 */
describe('isDigitFreeNarrative (no-digit guard, KTD 5)', () => {
  // MUST be rejected — every form carries a digit a unit denylist would miss.
  const MUST_REJECT = [
    '10W-30',
    'SAE 10W-30',
    '4.8 L',
    '3.4 quarts',
    'every 16,000 km',
    '8,000-mile interval',
    '0.20–0.24 mm', // en-dash range
    'kPa is 290', // kPa alone has no digit, but a real value does
    '34 Nm',
    '2 years',
  ];

  // MUST be accepted — clean prose with no digits, referring to tables generically.
  const MUST_ACCEPT = [
    'See the schedule below for exact intervals.',
    'Engine oil and filter changes are the backbone of the service plan.',
    'Valve clearance checks belong to a dealer for most owners.',
    'kPa', // a bare unit token with no digit is fine in prose
    'lb-ft', // ditto
    'Replace brake fluid periodically as listed in the table above.',
    '',
  ];

  for (const fixture of MUST_REJECT) {
    it(`rejects ${JSON.stringify(fixture)}`, () => {
      expect(isDigitFreeNarrative(fixture)).toBe(false);
    });
  }

  for (const fixture of MUST_ACCEPT) {
    it(`accepts ${JSON.stringify(fixture)}`, () => {
      expect(isDigitFreeNarrative(fixture)).toBe(true);
    });
  }
});

describe('findDigitViolations (recursive field walk)', () => {
  it('returns empty for a fully clean narrative', () => {
    const clean = {
      intro: 'Owning this bike is rewarding when you keep up with service.',
      diyVsDealer: 'Some jobs suit a home garage; others belong to a dealer.',
      ownershipNotes: 'Treat the schedule below as your baseline.',
      sections: [{ heading: 'Fluids', body: 'Keep the fluids fresh, see the table.' }],
      keyTakeaways: ['Follow the schedule below.', 'Verify against your manual.'],
    };
    expect(findDigitViolations(clean)).toEqual([]);
  });

  it('reports the exact dotted path of each digit violation', () => {
    const dirty = {
      intro: 'Change the oil every 8,000 miles.',
      sections: [
        { heading: 'Clean', body: 'No numbers here.' },
        { heading: 'Torque to 34 Nm', body: 'Fine body.' },
      ],
      keyTakeaways: ['Clean takeaway.', 'Valve gap is 0.20 mm.'],
    };
    const violations = findDigitViolations(dirty);
    expect(violations).toContain('intro');
    expect(violations).toContain('sections[1].heading');
    expect(violations).toContain('keyTakeaways[1]');
    expect(violations).not.toContain('sections[0].heading');
    expect(violations).not.toContain('sections[0].body');
  });
});
