import { describe, expect, it } from 'vitest';
import type { BikePageData } from '../bike-data';
import { scoreBikePage } from '../quality-gate';

function makeWords(n: number, seed: string): string {
  const words: string[] = [];
  for (let i = 0; i < n; i++) {
    words.push(`${seed}${i}`);
  }
  return words.join(' ');
}

function makePage(overrides: Partial<BikePageData>): BikePageData {
  return {
    make: 'TestMake',
    makeSlug: 'testmake',
    model: 'TestModel',
    modelSlug: 'testmodel',
    year: 2023,
    pageType: 'overview',
    title: 'Test',
    description: 'Test',
    h1: 'Test',
    bodyParagraphs: [makeWords(600, 'alpha')],
    specs: [
      { label: 'Engine', value: '1000 cc' },
      { label: 'Power', value: '200 hp' },
      { label: 'Torque', value: '110 Nm' },
      { label: 'Weight', value: '200 kg' },
      { label: 'Fuel', value: '17 L' },
    ],
    faqItems: [],
    ...overrides,
  };
}

describe('scoreBikePage', () => {
  it('passes a 500+ word unique page with enough data points', () => {
    const page = makePage({});
    const result = scoreBikePage(page, [page]);
    expect(result.wordCount).toBeGreaterThanOrEqual(500);
    expect(result.dataPointCount).toBeGreaterThanOrEqual(5);
    expect(result.uniquenessRatio).toBeGreaterThanOrEqual(0.4);
    expect(result.passes).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('fails a 100-word page on word count', () => {
    const page = makePage({ bodyParagraphs: [makeWords(100, 'alpha')] });
    const result = scoreBikePage(page, [page]);
    expect(result.wordCount).toBe(100);
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes('wordCount'))).toBe(true);
  });

  it('fails two near-identical pages on uniqueness', () => {
    const body = makeWords(700, 'sharedword');
    const pageA = makePage({
      makeSlug: 'makea',
      modelSlug: 'modela',
      bodyParagraphs: [body],
    });
    const pageB = makePage({
      makeSlug: 'makeb',
      modelSlug: 'modelb',
      bodyParagraphs: [body],
    });
    const result = scoreBikePage(pageA, [pageA, pageB]);
    expect(result.uniquenessRatio).toBeLessThan(0.4);
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes('uniquenessRatio'))).toBe(true);
  });

  it('fails a page with fewer than 5 data points', () => {
    const page = makePage({
      specs: [
        { label: 'A', value: '1' },
        { label: 'B', value: '2' },
      ],
    });
    const result = scoreBikePage(page, [page]);
    expect(result.dataPointCount).toBe(2);
    expect(result.passes).toBe(false);
    expect(result.reasons.some((r) => r.includes('dataPointCount'))).toBe(true);
  });
});
