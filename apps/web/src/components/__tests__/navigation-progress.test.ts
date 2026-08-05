import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startsInAppNavigation } from '../navigation-progress';

/**
 * The bar's correctness lives entirely in "will this click actually navigate?".
 * A false positive leaves a progress bar running over a page that never changed
 * (a mailto:, a new tab, an in-page anchor); a false negative shows no feedback.
 *
 * jsdom is not configured for this app's vitest run, so build a minimal anchor
 * stand-in rather than touching the DOM. It mirrors the three properties the
 * predicate reads: `target`, the `download`/`href` attributes, and the
 * origin-resolved absolute `href`.
 */
const ORIGIN = 'https://motovault.app';
const CURRENT = '/trips/us/mt/beartooth-highway';

interface FakeAnchorInit {
  href: string | null;
  target?: string;
  download?: boolean;
}

function anchor({ href, target = '', download = false }: FakeAnchorInit) {
  return {
    target,
    hasAttribute: (name: string) => name === 'download' && download,
    getAttribute: (name: string) => (name === 'href' ? href : null),
    // Browsers expose `.href` already absolute; resolve relative paths the same way.
    get href() {
      return href == null ? '' : new URL(href, `${ORIGIN}${CURRENT}`).toString();
    },
  } as unknown as HTMLAnchorElement;
}

describe('startsInAppNavigation', () => {
  const original = globalThis.window;

  beforeAll(() => {
    // The predicate compares against window.location.
    globalThis.window = {
      location: { origin: ORIGIN, pathname: CURRENT, search: '' },
    } as unknown as Window & typeof globalThis;
  });
  afterAll(() => {
    globalThis.window = original;
  });

  it('is true for a same-origin link to a different path', () => {
    expect(startsInAppNavigation(anchor({ href: '/explore/us' }))).toBe(true);
    expect(startsInAppNavigation(anchor({ href: `${ORIGIN}/explore/us/mt` }))).toBe(true);
  });

  it('is true for a same-path link that changes the query string', () => {
    expect(startsInAppNavigation(anchor({ href: `${CURRENT}?tab=reviews` }))).toBe(true);
  });

  it('is false for an in-page hash anchor', () => {
    // The tab nav on trip detail is all #overview / #days links — these must
    // never show a bar, since no navigation occurs at all.
    expect(startsInAppNavigation(anchor({ href: '#days' }))).toBe(false);
  });

  it('is false for a link to the URL already open', () => {
    expect(startsInAppNavigation(anchor({ href: CURRENT }))).toBe(false);
  });

  it('is false for an external link', () => {
    // e.g. the App Store CTAs present on every marketing page.
    expect(
      startsInAppNavigation(anchor({ href: 'https://apps.apple.com/us/app/id6760291360' })),
    ).toBe(false);
  });

  it('is false for a link opening a new context', () => {
    expect(startsInAppNavigation(anchor({ href: '/explore/us', target: '_blank' }))).toBe(false);
  });

  it('is true when target is explicitly the current frame', () => {
    expect(startsInAppNavigation(anchor({ href: '/explore/us', target: '_self' }))).toBe(true);
  });

  it('is false for a download link', () => {
    // GPX downloads replace no page.
    expect(startsInAppNavigation(anchor({ href: '/api/gpx/abc', download: true }))).toBe(false);
  });

  it('is false for non-http schemes and a missing href', () => {
    expect(startsInAppNavigation(anchor({ href: 'mailto:hello@motovault.app' }))).toBe(false);
    expect(startsInAppNavigation(anchor({ href: 'tel:+100' }))).toBe(false);
    expect(startsInAppNavigation(anchor({ href: null }))).toBe(false);
  });
});
