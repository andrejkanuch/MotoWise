import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LONG_REVALIDATE_SECONDS } from './cache-windows';

const SRC_DIR = path.resolve(__dirname, '..');

/** Pages on the long window. Their `revalidate` must be a literal (Next.js), so it is pinned here. */
const LONG_WINDOW_PAGES = [
  'app/[locale]/(marketing)/page.tsx',
  'app/[locale]/(marketing)/blog/[slug]/page.tsx',
  'app/[locale]/(marketing)/explore/page.tsx',
  'app/[locale]/(marketing)/explore/[country]/page.tsx',
  'app/[locale]/(marketing)/explore/[country]/[region]/page.tsx',
  'app/(root)/explore/[country]/page.tsx',
  'app/(root)/explore/[country]/[region]/page.tsx',
  'app/(root)/trips/[country]/[region]/[slug]/page.tsx',
];

/** Caches those pages read. A literal window here would cap every page that reads it. */
const LONG_WINDOW_CACHES = [
  'lib/supabase-blog.ts',
  'lib/fetch-places.ts',
  'lib/seo/app-store-rating.ts',
];

const read = (file: string) => readFileSync(path.join(SRC_DIR, file), 'utf8');

describe('long ISR window', () => {
  it.each(LONG_WINDOW_PAGES)('%s revalidates on the shared window', (file) => {
    const match = read(file).match(/^export const revalidate = (\d+);/m);
    expect(Number(match?.[1])).toBe(LONG_REVALIDATE_SECONDS);
  });

  it.each(LONG_WINDOW_CACHES)('%s uses the shared constant for every cache window', (file) => {
    const source = read(file);
    expect(source).toContain('LONG_REVALIDATE_SECONDS');
    expect(source.match(/revalidate:\s*\d+/g) ?? []).toEqual(
      file === 'lib/supabase-blog.ts' ? ['revalidate: 3600'] : [],
    );
  });

  // A swallowed fetch error resolves to an empty list, which ISR then serves for the
  // whole window. The country page must let it throw so the last good render stays.
  it.each([
    'app/(root)/explore/[country]/page.tsx',
    'app/[locale]/(marketing)/explore/[country]/page.tsx',
  ])('%s does not turn a failed fetch into an empty list', (file) => {
    expect(read(file)).not.toMatch(/\.catch\(\(\) => \[/);
  });
});
