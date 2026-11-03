import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HERO_ASSIGN_SCRIPT,
  HERO_ASSIGN_SCRIPT_CSP_HASH,
  HERO_ATTRIBUTE,
  HERO_COOKIE,
  HERO_VARIANT,
} from '../hero-experiment';

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const OPT_OUT_REGION = 'mv_region=OTHER';
const OPT_IN_REGION = 'mv_region=EU';
const ACCEPTED = `mv_consent=${encodeURIComponent('v1:accepted:1700000000:EU:explicit')}`;
const REJECTED = `mv_consent=${encodeURIComponent('v1:rejected:1700000000:EU:explicit')}`;

/** Runs the inline script against a fake document; returns the attribute and cookie writes. */
function runScript(cookie: string, userAgent = BROWSER_UA) {
  const writes: string[] = [];
  const attributes: Record<string, string> = {};
  const document = {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      writes.push(value);
    },
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  new Function('document', 'location', 'navigator', HERO_ASSIGN_SCRIPT)(
    document,
    { protocol: 'https:' },
    { userAgent },
  );
  return { variant: attributes[HERO_ATTRIBUTE], writes };
}

const variants = Object.values(HERO_VARIANT);

describe('hero A/B assignment script', () => {
  afterEach(() => vi.restoreAllMocks());

  it('matches its CSP hash (the strict-CSP routes allow it by hash)', () => {
    const digest = createHash('sha256').update(HERO_ASSIGN_SCRIPT, 'utf8').digest('base64');
    expect(HERO_ASSIGN_SCRIPT_CSP_HASH).toBe(`'sha256-${digest}'`);
  });

  it('randomizes an opt-out-region visitor and remembers the variant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { variant, writes } = runScript(OPT_OUT_REGION);
    expect(variant).toBe(variants[variants.length - 1]);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(new RegExp(`^${HERO_COOKIE}=${variant}; path=/; max-age=\\d+`));
    expect(writes[0]).toContain('; Secure');
  });

  it('randomizes an EU visitor who accepted analytics', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { variant, writes } = runScript(`${OPT_IN_REGION}; ${ACCEPTED}`);
    expect(variant).toBe(variants[1]);
    expect(writes).toHaveLength(1);
  });

  it('keeps an EU visitor without a decision on the control, with no cookie', () => {
    const { variant, writes } = runScript(OPT_IN_REGION);
    expect(variant).toBe(HERO_VARIANT.Control);
    expect(writes).toEqual([]);
  });

  it('keeps an assigned visitor on their variant without rewriting the cookie', () => {
    const { variant, writes } = runScript(
      `${OPT_OUT_REGION}; ${HERO_COOKIE}=${HERO_VARIANT.Service}`,
    );
    expect(variant).toBe(HERO_VARIANT.Service);
    expect(writes).toEqual([]);
  });

  it('replaces an unknown stored variant', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { variant, writes } = runScript(`${OPT_OUT_REGION}; ${HERO_COOKIE}=retired`);
    expect(variant).toBe(variants[0]);
    expect(writes).toHaveLength(1);
  });

  it('shows the control and clears the assignment after a reject', () => {
    const { variant, writes } = runScript(
      `${OPT_IN_REGION}; ${REJECTED}; ${HERO_COOKIE}=${HERO_VARIANT.Cost}`,
    );
    expect(variant).toBe(HERO_VARIANT.Control);
    expect(writes).toEqual([`${HERO_COOKIE}=; path=/; max-age=0`]);
  });

  it('shows crawlers the control', () => {
    const { variant, writes } = runScript(OPT_OUT_REGION, GOOGLEBOT_UA);
    expect(variant).toBe(HERO_VARIANT.Control);
    expect(writes).toEqual([]);
  });
});
