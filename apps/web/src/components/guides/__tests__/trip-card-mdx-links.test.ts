import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the trip-card regression: every <TripCard> in a guide MDX file must
 * carry country, region and slug so the card links to the canonical
 * three-segment /trips/{country}/{region}/{slug} route. A one-segment
 * /trips/{slug} link has no route and always 404s.
 */

const GUIDES_DIR = path.join(process.cwd(), 'src/content/guides');

function guideFiles(): string[] {
  return fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.mdx'));
}

function tripCardTags(source: string): string[] {
  return source.match(/<TripCard\b[\s\S]*?\/>/g) ?? [];
}

describe('guide MDX TripCard links', () => {
  const files = guideFiles();

  it('has at least one guide with a TripCard', () => {
    const total = files.reduce(
      (n, f) => n + tripCardTags(fs.readFileSync(path.join(GUIDES_DIR, f), 'utf-8')).length,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });

  for (const file of files) {
    const source = fs.readFileSync(path.join(GUIDES_DIR, file), 'utf-8');
    for (const tag of tripCardTags(source)) {
      it(`${file}: ${tag.replace(/\s+/g, ' ')} points at a three-segment trip route`, () => {
        expect(tag).toMatch(/\bcountry=/);
        expect(tag).toMatch(/\bregion=/);
        expect(tag).toMatch(/\bslug=/);
      });
    }
  }
});
