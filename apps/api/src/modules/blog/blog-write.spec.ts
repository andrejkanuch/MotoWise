import { describe, expect, it } from 'vitest';
import { translationToRow, typeDataToRow } from './blog-write';

describe('typeDataToRow', () => {
  it('maps gear typeData to the gear table row (camelCase -> snake_case)', () => {
    const { table, row } = typeDataToRow('p1', {
      type: 'gear',
      brand: 'Shoei',
      model: 'GT-Air II',
      rating: 4.5,
      priceEur: 499,
      verdict: 'great',
      meta: {},
    });
    expect(table).toBe('blog_post_gear');
    expect(row).toMatchObject({ post_id: 'p1', brand: 'Shoei', price_eur: 499, rating: 4.5 });
  });

  it('maps maintenance dataset arrays', () => {
    const { table, row } = typeDataToRow('p2', {
      type: 'maintenance',
      make: 'HONDA',
      model: 'CRF1100',
      variant: 'DCT',
      datasetModels: ['HONDA/CRF1100/DCT'],
      applicableModels: [],
      meta: {},
    });
    expect(table).toBe('blog_post_maintenance');
    expect(row).toMatchObject({ make: 'HONDA', dataset_models: ['HONDA/CRF1100/DCT'] });
  });

  it('maps a minimal guide', () => {
    const { table, row } = typeDataToRow('p3', { type: 'guide', meta: {} });
    expect(table).toBe('blog_post_guide');
    expect(row).toMatchObject({ post_id: 'p3', difficulty: null });
  });
});

describe('translationToRow', () => {
  it('derives body_text + word_count and sets keyword_text', () => {
    const row = translationToRow(
      'p1',
      { locale: 'en', title: 'T', bodyRaw: '## Heading\n\nHello **world**.' },
      'oil change valve',
    );
    expect(row.post_id).toBe('p1');
    expect(row.locale).toBe('en');
    expect(row.keyword_text).toBe('oil change valve');
    expect(row.body_text).not.toMatch(/[#*]/);
    expect(row.word_count).toBeGreaterThan(0);
    expect(row.faq).toEqual([]);
  });
});
