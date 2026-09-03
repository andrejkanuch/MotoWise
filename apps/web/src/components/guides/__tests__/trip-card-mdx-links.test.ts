import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the trip-card regression: every <TripCard> in a guide MDX file must
 * carry country, region and slug so the card links to the canonical
 * three-segment /trips/{country}/{region}/{slug} route. A one-segment
 * /trips/{slug} link has no route and always 404s.
 *
 * MDX is not typechecked, so TripCardProps requiring country/region cannot
 * catch a card that omits them — an omitted prop renders
 * /trips/undefined/undefined/{slug}. This file is the only guard, so it is
 * written to fail loudly rather than pass vacuously:
 *   - the tag regex stops at the first `>` so a malformed tag can never merge
 *     with the next well-formed one and borrow its attributes;
 *   - each attribute is checked for a non-empty value of the right shape, not
 *     merely for its presence (`country=""` builds a broken href too).
 * Resolved from this file's own location rather than process.cwd() so the
 * suite behaves identically from the repo root and from apps/web.
 */

const GUIDES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../content/guides',
);

// Stops at the first `>`: a non-self-closing <TripCard> matches on its own
// (and then fails the self-closing assertion) instead of the lazy [\s\S]*?
// scan running on to a later card's `/>` and swallowing both.
const TRIP_CARD_TAG = /<TripCard\b[^>]*>/g;

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY = /^[a-z]{2}$/;

function guideFiles(): string[] {
  return fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.mdx'));
}

function readGuide(file: string): string {
  return fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
}

function tripCardTags(source: string): string[] {
  return source.match(TRIP_CARD_TAG) ?? [];
}

/** Literal value of a double-quoted attribute, or null when absent/non-literal. */
function attr(tag: string, name: string): string | null {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

describe('guide MDX TripCard links', () => {
  const files = guideFiles();

  it('has at least one guide with a TripCard', () => {
    const total = files.reduce((n, f) => n + tripCardTags(readGuide(f)).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  for (const file of files) {
    for (const tag of tripCardTags(readGuide(file))) {
      const label = tag.replace(/\s+/g, ' ');

      it(`${file}: ${label} points at a three-segment trip route`, () => {
        // A non-self-closing tag means the regex above matched an opening tag;
        // MDX cards must be self-closing.
        expect(tag.endsWith('/>')).toBe(true);

        const country = attr(tag, 'country');
        const region = attr(tag, 'region');
        const slug = attr(tag, 'slug');

        // Present as double-quoted literals: an expression-valued attribute
        // (country={x}) cannot be checked here and must not pass silently.
        expect(country).not.toBeNull();
        expect(region).not.toBeNull();
        expect(slug).not.toBeNull();

        // Non-empty values of the right shape: an empty attribute still
        // builds a href that 404s.
        expect(country ?? '').toMatch(COUNTRY);
        expect(region ?? '').toMatch(SEGMENT);
        expect(slug ?? '').toMatch(SEGMENT);
      });
    }
  }
});
