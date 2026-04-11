import { describe, expect, it } from 'vitest';
import { BIKE_FIXTURES, findBikePage, PAGE_TYPES, type PageType } from '../bike-data';
import { scoreBikePage } from '../quality-gate';

const PAGE_TYPE_SET = new Set<PageType>(PAGE_TYPES);

describe('BIKE_FIXTURES', () => {
  it('contains entries', () => {
    expect(BIKE_FIXTURES.length).toBeGreaterThan(0);
  });

  it('every entry has ≥500 words of body prose', () => {
    for (const page of BIKE_FIXTURES) {
      const wordCount = page.bodyParagraphs.join(' ').split(/\s+/).filter(Boolean).length;
      expect(
        wordCount,
        `${page.makeSlug}/${page.modelSlug}/${page.year}/${page.pageType} wordCount=${wordCount}`,
      ).toBeGreaterThanOrEqual(500);
    }
  });

  it('every entry has ≥5 specs', () => {
    for (const page of BIKE_FIXTURES) {
      expect(page.specs.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('every entry has non-empty faqItems', () => {
    for (const page of BIKE_FIXTURES) {
      expect(page.faqItems.length).toBeGreaterThan(0);
      for (const item of page.faqItems) {
        expect(item.question).toBeTruthy();
        expect(item.answer).toBeTruthy();
      }
    }
  });

  it('every entry has a valid PageType', () => {
    for (const page of BIKE_FIXTURES) {
      expect(PAGE_TYPE_SET.has(page.pageType)).toBe(true);
    }
  });

  it('every entry has consistent slugs', () => {
    for (const page of BIKE_FIXTURES) {
      expect(page.makeSlug).toMatch(/^[a-z0-9-]+$/);
      expect(page.modelSlug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('every fixture passes the quality gate', () => {
    for (const page of BIKE_FIXTURES) {
      const result = scoreBikePage(page, BIKE_FIXTURES);
      expect(
        result.passes,
        `${page.makeSlug}/${page.modelSlug}/${page.year}/${page.pageType} failed: ${result.reasons.join('; ')}`,
      ).toBe(true);
    }
  });
});

describe('findBikePage', () => {
  it('finds an existing fixture by slug/year/pageType', () => {
    const page = findBikePage({
      make: 'yamaha',
      model: 'yzf-r1',
      year: '2023',
      pageType: 'overview',
    });
    expect(page).toBeDefined();
    expect(page?.make).toBe('Yamaha');
    expect(page?.model).toBe('YZF-R1');
  });

  it('returns undefined for an unknown bike', () => {
    expect(
      findBikePage({
        make: 'yamaha',
        model: 'nonexistent',
        year: '2023',
        pageType: 'overview',
      }),
    ).toBeUndefined();
  });

  it('returns undefined for a non-numeric year', () => {
    expect(
      findBikePage({
        make: 'yamaha',
        model: 'yzf-r1',
        year: 'abc',
        pageType: 'overview',
      }),
    ).toBeUndefined();
  });
});
