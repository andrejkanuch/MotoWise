import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureMessage }));

import { isExpectedNotFound, reportSoftNotFound } from '../soft-404';

/**
 * The bogus rows of the 404-contract probe that land on a route calling
 * reportSoftNotFound (trip detail + explore). Parsed from the script itself so a
 * new probe row cannot silently start paging Sentry on every deploy again.
 */
function probeBogusDetails(): Record<string, string>[] {
  const script = readFileSync(
    path.resolve(__dirname, '../../../../../../scripts/check-404-contract.sh'),
    'utf8',
  );
  const rows = [...script.matchAll(/^404 (\/\S+)\s+\S+:bogus$/gm)].map((m) => m[1]);
  const details = rows.flatMap((p): Record<string, string>[] => {
    const parts = p.split('/').filter(Boolean);
    const segs = /^[a-z]{2}$/.test(parts[0]) && parts[1] === 'explore' ? parts.slice(1) : parts;
    if (segs[0] === 'trips' && segs.length === 4) {
      return [{ country: segs[1], region: segs[2], slug: segs[3] }];
    }
    if (segs[0] === 'explore' && segs.length === 2) return [{ country: segs[1] }];
    if (segs[0] === 'explore' && segs.length === 3) return [{ country: segs[1], region: segs[2] }];
    return [];
  });
  return details;
}

describe('isExpectedNotFound', () => {
  it('covers every trip/explore bogus row of the 404-contract probe', () => {
    const details = probeBogusDetails();
    // trip-detail + explore-country/region, each with and without the /de prefix.
    expect(details.length).toBeGreaterThanOrEqual(5);
    for (const detail of details) {
      expect(isExpectedNotFound(detail), JSON.stringify(detail)).toBe(true);
    }
  });

  it('treats scanner-shaped segments as expected (MOTOVAULT-WEB-Q: slug "products.json")', () => {
    expect(isExpectedNotFound({ country: 'za', region: 'za-wc', slug: 'products.json' })).toBe(
      true,
    );
    expect(isExpectedNotFound({ country: '.env' })).toBe(true);
    expect(isExpectedNotFound({ country: 'us', region: 'wp-login.php' })).toBe(true);
  });

  it('still reports well-formed URLs that fail to resolve', () => {
    expect(isExpectedNotFound({ country: 'us', region: 'mt', slug: 'beartooth-highway' })).toBe(
      false,
    );
    expect(isExpectedNotFound({ country: 'me', region: 'ME-KO', slug: 'bay-of-kotor-loop' })).toBe(
      false,
    );
    expect(isExpectedNotFound({ country: 'pe', region: 'pe-ica', slug: 'null' })).toBe(false);
    // `locale` is not a route segment and never makes a soft-404 "expected".
    expect(isExpectedNotFound({ locale: 'de', country: 'us', region: 'mt' })).toBe(false);
  });
});

describe('reportSoftNotFound', () => {
  beforeEach(() => {
    captureMessage.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('sends a real soft-404 to Sentry', () => {
    reportSoftNotFound('explore-region', { country: 'us', region: 'mt' });
    expect(captureMessage).toHaveBeenCalledWith('soft-404: explore-region', {
      level: 'warning',
      extra: { scope: 'explore-region', country: 'us', region: 'mt' },
    });
  });

  it('logs but does not send the probe sentinels to Sentry', () => {
    reportSoftNotFound('explore-region', { locale: 'de', country: 'us', region: 'zz-99' });
    expect(captureMessage).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[soft-404] explore-region', expect.any(String));
  });
});
